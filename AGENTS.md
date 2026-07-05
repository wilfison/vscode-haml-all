# AI Agent Development Guide

## Project Overview

**HAML All-in-One** is a VS Code extension for HAML development: syntax highlighting, linting, formatting, Rails integration (partials, routes, assets), and HTML/ERB conversion. Activates on `onLanguage:haml`.

### Core Architecture

Provider-based, with three subsystems:

1. **Ruby Server Bridge** (`src/server/` + `lib/server.rb`): persistent TCP socket server (port 7654+, auto-increments if busy) for haml-lint operations. Actions: `lint`, `autocorrect`, `compile`, `list_cops`. Uses `--use-bundler` when `hamlAll.useBundler` is set. JSON protocol — see `lib/lint_server/controller.rb`. Logs go to the "Haml" output channel.
2. **Event-Driven Diagnostics** (`src/EventSubscriber.ts`): file watching and validation.
3. **Rails-Aware Features** (`src/rails/`, `src/providers/`): active only when `bin/rails` exists (`Helpers.isARailsProject()`).

## Build & Test

```bash
npm run watch      # auto-compile TypeScript (dev)
npm run compile    # one-time compilation
npm test           # TS/extension tests (compile first)
```

Log via `window.createOutputChannel('Haml')`, never `console.log()`.

### Versioning & Changelog

- Do NOT bump `version` in `package.json` for a feature/fix — the maintainer bumps it at release.
- Document changes in `CHANGELOG.md` under `## [Unreleased]` (create if missing). No invented versions/dates. Only user-visible changes belong here — not CI/infra.

### Ruby tests (linting server)

`lib/` is tested with **Minitest** under `test/`, mirroring the `lib/` layout (`lib/lint_server/dispatcher.rb` → `test/lib/lint_server/dispatcher_test.rb`).

```bash
bundle exec rake      # default task, runs all test/**/*_test.rb
bundle exec ruby -Itest -Ilib test/lib/lint_server/dispatcher_test.rb   # single file
```

Do NOT run `ruby -Itest test/**/*_test.rb` — Ruby executes only the first file and passes the rest as ARGV, so most tests silently never run. Use Rake.

- `test/test_helper.rb` sets the load path, requires server components, and provides `FakeClient` (in-memory socket with `#gets`/`#puts`/`#close`).
- Keep units socket-free: `Dispatcher.dispatch(request)` takes a Hash; `Controller.handle(client)` takes anything with `#gets`/`#puts`/`#close`.
- CI (`.github/workflows/ci.yml`, `release.yml`) runs `bundle exec rake test`, so new `*_test.rb` files are picked up automatically.

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
