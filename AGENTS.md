# AI Agent Development Guide

## Project Overview

**HAML All-in-One** is a VS Code extension for HAML development: syntax highlighting, linting, formatting, Rails integration (partials, routes, assets), and HTML/ERB conversion. Activates on `onLanguage:haml`.

### Core Architecture

Provider-based, with three subsystems:

1. **Ruby Server Bridge** (`src/server/` + `lib/server.rb`): persistent TCP socket server on `127.0.0.1` (port 7654+, auto-increments if busy) for haml-lint operations. Actions: `lint`, `autocorrect`, `list_cops`. Uses `--use-bundler` when `hamlAll.useBundler` is set. JSON protocol — see `lib/lint_server/controller.rb`. Logs go to the "Haml" output channel. **Security**: the client passes a per-session token via the `HAML_LINT_SERVER_TOKEN` env var and echoes it in every request (`Controller#authorized?` rejects mismatches); `config_file` is confined to the server's working dir (the workspace root) in `Report.safe_config_file`, since a config's `require:` can execute Ruby.
2. **Event-Driven Diagnostics** (`src/EventSubscriber.ts`): file watching and validation.
3. **Rails-Aware Features** (`src/rails/`, `src/providers/`): active only when `bin/rails` exists (`Helpers.isARailsProject()`).

## Build & Test

The extension ships as a single **esbuild** bundle at `dist/extension.js` (the `main` entry). `tsc` is used only for type-checking (`--noEmit`) and for compiling the test tree to `out/`; the shipped code never comes from `out/`.

```bash
npm run watch      # dev: esbuild + tsc type-check watchers in parallel
npm run compile    # one-time: type-check, lint, then esbuild bundle -> dist/
npm test           # TS/extension tests (pretest compiles tests -> out/ and the bundle -> dist/)
```

Bundling collapses every module into `dist/extension.js`, so `__dirname` can no longer walk up to the extension root (its depth differs between the bundle and the `tsc` test build). Resolve bundled asset paths (`lib/`, `templates/`) via `getExtensionRoot()` (`src/utils/extensionRoot.ts`), seeded from `context.extensionPath` at the top of `activate()` — never `path.join(__dirname, '..', ...)`.

Log via `window.createOutputChannel('Haml')`, never `console.log()`.

### Versioning & Changelog

- Do NOT bump `version` in `package.json` for a feature/fix — the maintainer bumps it at release.
- Document changes in `CHANGELOG.md` under `## [Unreleased]` (create if missing). No invented versions/dates. Only user-visible changes belong here — not CI/infra.

### Releasing

Releases are cut by pushing a git tag; `.github/workflows/release.yml` does the rest (package → publish → GitHub Release). To cut version `X.Y.Z`:

1. On `main` with CI green, bump `version` in `package.json` and `package-lock.json` to `X.Y.Z`.
2. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and start a fresh empty `## [Unreleased]` above it. The release notes are auto-extracted from the `## [X.Y.Z]` section, so the header must match the version **exactly**.
3. Commit both, then tag and push: `git tag vX.Y.Z && git push origin main --tags`.

The tag **must** be a lowercase `v` + the exact `package.json` version (`v3.0.1` for `3.0.1`). The workflow triggers on `v*`, strips the leading `v` (`${TAG#v}`), and fails the "Verify tag matches package.json version" step on any mismatch. Note: legacy tags (`V3.0.0`) used an uppercase `V` and predate this workflow — they would neither trigger it nor pass the check. Use lowercase.

### Ruby tests (linting server)

`lib/` is tested with **Minitest** under `test/`, mirroring the `lib/` layout (`lib/lint_server/dispatcher.rb` → `test/lib/lint_server/dispatcher_test.rb`).

```bash
bundle exec rake      # default task, runs all test/**/*_test.rb
bundle exec ruby -Itest -Ilib test/lib/lint_server/dispatcher_test.rb   # single file
```

Do NOT run `ruby -Itest test/**/*_test.rb` — Ruby executes only the first file and passes the rest as ARGV, so most tests silently never run. Use Rake.

- `test/test_helper.rb` sets the load path, requires server components, and provides `FakeClient` (in-memory socket with `#gets`/`#puts`/`#close`) plus `LintServerTestHelpers` (`lint_request` — the lightest real action for round-trip tests).
- Keep units socket-free: `Dispatcher.dispatch(request)` takes a Hash; `Controller.handle(client)` takes anything with `#gets`/`#puts`/`#close`.
- CI (`.github/workflows/ci.yml`, `release.yml`) runs `bundle exec rake test`, so new `*_test.rb` files are picked up automatically.

### Ruby linting (RuboCop)

The project's own Ruby (`lib/` + `test/`) is linted with **RuboCop** (config in `.rubocop.yml`: TargetRubyVersion 3.3, double-quoted strings, `NewCops: enable`, `Metrics/MethodLength` Max 20, `Metrics/AbcSize` at the default 17).

```bash
bundle exec rubocop      # check
bundle exec rubocop -A   # safe autocorrect
```

CI (`ci.yml`, `release.yml`) runs `bundle exec rubocop` as a gate, so a Ruby change with any offense fails the build. The **default rake task is just `test`** (RuboCop is not in it), so run `bundle exec rubocop` locally before pushing — keep it at **0 offenses**. `NewCops: enable` means a gem bump can surface new offenses in untouched files; fix them in the same change. Don't add inline `# rubocop:disable` to dodge `Metrics/*` — extract a helper instead (see the `free_port` / `start_server_in_thread` split in `test/lib/server_test.rb`).

Note: RuboCop is also a runtime dependency (haml-lint uses it for formatting) — that's separate from this dev-time linting.

## Project-Specific Patterns

### Provider registration

Registered in `ExtensionActivator.ts`, split by scope:

- `registerHamlProviders()` — formatting, partials, code actions (always).
- `registerRailsProviders()` — routes, assets (only when `isARailsProject`).

New feature → create provider in `src/providers/`, register there. All subscriptions/watchers/providers MUST be added to `context.subscriptions` (memory leaks otherwise).

### Caching

Expensive operations use time-based + mtime caching. Reference: `Routes.load()` in `src/rails/routes.ts` (5-min TTL + `routes.rb` mtime). When adding: store `lastLoadTime` + file `mtimeMs`, implement `isCacheValid()`, log hits/misses, clear on watcher events.

### File watchers

Pattern in `EventSubscriber.ts` (`subscribeFileWatcher`). Watched:

- `**/.haml-lint.yml` → reload linter config
- `**/config/routes.rb`, `**/config/routes/**/*.rb` → reload routes

### Diagnostics & code actions

- **Linting** (`src/linter/index.ts`): runs on change/save/open, sends content to the Ruby server, parses offenses into a `DiagnosticCollection` named `'haml-lint'`.
- **Refactor actions** (`ViewCodeActionProvider`): extract to partial, wrap in conditional/block.
- **Quick fixes** (`FixActionsProvider`): cop-specific auto-fixes in `src/quick_fixes/`.

### Rails integration

1. **Routes** (`src/rails/router_parser.ts`): parses `bin/rails routes -E` (expanded).
2. **Partials**: resolved from `app/views/**/*.haml`.
3. **Assets**: paths from `app/assets/images/**`.

Use `loadWithProgress()` from `rails/utils.ts` for long operations.

## Dependencies (Gemfile, development/test group)

- **haml-lint** (required) — linting engine
- **rubocop** (required) — used by haml-lint for formatting
- **html2haml** (optional) — HTML/ERB → HAML conversion

## Configuration

Settings live in `package.json` → `contributes.configuration` (e.g. `hamlAll.lintEnabled`, `hamlAll.useBundler`, `hamlAll.linterExecutablePath`). Read via `vscode.workspace.getConfiguration('hamlAll')`; react to changes with `onDidChangeConfiguration` + `event.affectsConfiguration(...)`.

## Gotchas

1. **Server not starting**: haml-lint gem missing or wrong executable path.
2. **HAML filter blocks** (`:javascript`, `:css`) have different indentation rules — see `src/formatter/index.ts`.
3. **Rails false negatives**: some Ruby projects lack `bin/rails` but still need HAML support.
4. **HAML attribute syntaxes**: support all three — `%div{class: 'foo'}`, `%div(class="foo")`, `%div{:class => 'foo'}`.

## Key Files

- `src/extension.ts` — entry point, activation/deactivation
- `src/ExtensionActivator.ts` — feature registration hub
- `src/EventSubscriber.ts` — event coordination and file watching
- `src/server/index.ts` — Ruby server TCP client
- `lib/server.rb` — Ruby server implementation
- `src/linter/index.ts` — diagnostic management
- `src/formatter/index.ts` — auto-correction logic
- `src/rails/routes.ts` — Rails routes parser & cache
