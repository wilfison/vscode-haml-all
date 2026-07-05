# AI Agent Development Guide

## Project Overview

**HAML All-in-One** is a VS Code extension providing comprehensive HAML development tools including syntax highlighting, linting, formatting, Rails integration (partials, routes, assets), and HTML/ERB conversion.

### Core Architecture

The extension follows a **provider-based architecture** with three main subsystems:

1. **Ruby Server Bridge** (`src/server/` + `lib/server.rb`): Persistent TCP socket server (port 7654+) for efficient haml-lint operations
2. **Event-Driven Diagnostics** (`src/EventSubscriber.ts`): Centralized event handling for file watching and validation
3. **Rails-Aware Features** (`src/rails/`, `src/providers/`): Optional features activated when Rails project detected

## Critical Developer Workflows

### Build & Development

```bash
npm run watch          # Auto-compile TypeScript (required for development)
npm run compile        # One-time compilation
npm test               # Run tests (requires compilation first)
```

**Important**: Press `F5` in VS Code to launch Extension Development Host for testing.

### Versioning & Changelog

**Rule**: Do NOT bump the `version` in `package.json` as part of a feature/fix change. The version is bumped only at release time by the maintainer.

When documenting changes in `CHANGELOG.md`, add them under an `## [Unreleased]` heading (create it if it doesn't exist) — do not invent a version number or release date. The maintainer promotes `[Unreleased]` to a real version when publishing.

### Testing Changes

The extension activates on `onLanguage:haml` event. To test:

1. Ensure watch task is running (`npm run watch` or use task `npm: watch`)
2. Press F5 to launch Extension Development Host
3. Open `.haml` file to trigger activation
4. Check Output Channel "Haml" for logs (`View > Output > Haml`)

### Ruby Server Lifecycle

The linting server (`lib/server.rb`) starts automatically on activation:

- Spawns Ruby process running TCP server on port 7654 (auto-increments if busy)
- Handles `lint`, `autocorrect`, `compile`, and `list_cops` actions
- Use `--use-bundler` flag when `hamlAll.useBundler` is enabled
- Server logs appear in "Haml" output channel

**Debugging Server Issues**: Check `outputChannel.appendLine()` calls in `src/server/index.ts` and Ruby STDOUT in `lib/server.rb`.

## Project-Specific Patterns

### Provider Registration Pattern

All providers are registered in `ExtensionActivator.ts` with clear separation:

- **HAML-only features**: `registerHamlProviders()` - formatting, partials, code actions
- **Rails features**: `registerRailsProviders()` - routes, assets (only when `isARailsProject === true`)

Example: Adding a new completion provider:

```typescript
// 1. Create provider in src/providers/
export class MyCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(document, position) {
    /* ... */
  }
}

// 2. Register in ExtensionActivator.ts
this.context.subscriptions.push(
  vscode.languages.registerCompletionItemProvider(
    this.HAML_SELECTOR,
    new MyCompletionProvider(),
    '.',
    '_' // Trigger characters
  )
);
```

### Caching Strategy

**Critical**: All expensive operations use time-based + modification-time caching:

- **Routes** (`src/rails/routes.ts`): 5-minute TTL + `routes.rb` mtime check
- **Pattern**: Check `isCacheValid()` → return cached data → else reload

Example from `Routes.load()`:

```typescript
if (this.routes.size > 0 && this.isCacheValid()) {
  this.outputChannel?.appendLine(`Using cached routes (${this.routes.size} routes)`);
  return;
}
```

**When adding caching**:

1. Store `lastLoadTime` and file `mtimeMs`
2. Implement `isCacheValid()` checking TTL and file changes
3. Log cache hits/misses to `outputChannel`
4. Clear cache on file watcher events

### Rails Detection

Rails features activate only when `bin/rails` executable exists (checked in `Helpers.isARailsProject()`). This prevents non-Rails HAML projects from loading unnecessary features.

### File Watchers & Reloading

Pattern from `EventSubscriber.ts`:

```typescript
private subscribeFileWatcher(pattern: string, callback: (e: Uri) => void): void {
  const watcher = workspace.createFileSystemWatcher(pattern);
  watcher.onDidChange(callback);
  watcher.onDidCreate(callback);
  this.context.subscriptions.push(watcher);  // Critical: prevent memory leaks
}
```

Watched patterns:

- `**/.haml-lint.yml` → reload linter config
- `**/config/routes.rb`, `**/config/routes/**/*.rb` → reload routes

### Diagnostics Flow

1. **Linting** (`src/linter/index.ts`):
   - Runs on `onDidChangeTextDocument`, `onDidSaveTextDocument`, `onDidOpenTextDocument`
   - Sends document content to Ruby server via TCP
   - Parses offenses into VS Code diagnostics
   - Uses `DiagnosticCollection` named `'haml-lint'`

### Code Actions (Quick Fixes)

Two types registered separately:

1. **Refactor Actions** (`ViewCodeActionProvider`): Extract to partial, wrap in conditional/block
2. **Quick Fixes** (`FixActionsProvider`): Auto-fix haml-lint offenses

Quick fixes are cop-specific (see `src/quick_fixes/`). Pattern:

```typescript
export function fixSpaceBeforeScript(offense, document): vscode.CodeAction[] {
  const line = document.lineAt(offense.location.line - 1);
  const edit = new vscode.WorkspaceEdit();
  // Apply fix...
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
  action.edit = edit;
  return [action];
}
```

## Integration Points & External Dependencies

### Ruby Dependencies

- **haml-lint** (required): Linting engine
- **rubocop** (required): Used by haml-lint for formatting
- **html2haml** (optional): HTML/ERB → HAML conversion

Install via `Gemfile`:

```ruby
group :development, :test do
  gem 'rubocop'
  gem 'haml-lint', require: false
end
```

### Rails Integration Points

1. **Routes** (`src/rails/router_parser.ts`): Parses output of `bin/rails routes -E` (expanded format)
2. **Partials**: Resolves from `app/views/**/*.haml` using workspace file search
3. **Assets**: Suggests paths from `app/assets/images/**`

### VS Code API Usage

- **Language Features**: `vscode.languages.register*Provider` for completion, hover, definition, formatting, code actions
- **Diagnostics**: `languages.createDiagnosticCollection()` for errors/warnings
- **Commands**: Registered via `vscode.commands.registerCommand()`, exposed in Command Palette
- **Output Logging**: Use `window.createOutputChannel('Haml')`, NOT `console.log()`

## Configuration System

User settings in `package.json` → `contributes.configuration`:

```json
"hamlAll.lintEnabled": true,
"hamlAll.useBundler": false,
"hamlAll.linterExecutablePath": "haml-lint"
```

Access in code:

```typescript
const config = vscode.workspace.getConfiguration('hamlAll');
const isEnabled = config.get<boolean>('lintEnabled', true);
```

Listen for changes:

```typescript
vscode.workspace.onDidChangeConfiguration((event) => {
  if (event.affectsConfiguration('hamlAll.lintEnabled')) {
    // React to config change
  }
});
```

## Testing Guidelines

Tests use VS Code's test framework (`@vscode/test-electron`). Located in `src/test/`.

**Pattern**: Create temporary documents for testing providers:

```typescript
const document = await vscode.workspace.openTextDocument({
  language: 'haml',
  content: '%div.test',
});
const position = new vscode.Position(0, 5);
const result = await provider.provideCompletionItems(document, position);
```

### Ruby tests (linting server)

The Ruby side (`lib/`) is tested with **Minitest**. Tests live under `test/`, mirroring the `lib/` layout (e.g. `lib/lint_server/dispatcher.rb` → `test/lib/lint_server/dispatcher_test.rb`).

**Run the whole suite** via Rake (the `test` task is the default):

```bash
bundle exec rake         # runs all test/**/*_test.rb (default task)
bundle exec rake test    # same, explicit
bundle exec rake -T      # list available tasks
```

Do NOT run `ruby -Itest test/**/*_test.rb` — Ruby only executes the first file and passes the rest as ARGV, so most tests silently never run. Use the Rake task. To run a single file during development: `bundle exec ruby -Itest -Ilib test/lib/lint_server/dispatcher_test.rb`.

**Conventions**:

- `test/test_helper.rb` sets up the load path, requires all server components, and provides `FakeClient` (an in-memory socket stand-in with `#gets`/`#puts`/`#close`) for testing the connection layer without a real socket.
- Keep units testable in isolation: `Dispatcher.dispatch(request)` takes a plain Hash (no socket), `Controller.handle(client)` takes any object responding to `#gets`/`#puts`/`#close`.
- Both CI workflows (`.github/workflows/ci.yml` and `release.yml`) run `bundle exec rake test`, so a new `*_test.rb` file is picked up automatically.

## Common Gotchas

1. **Server Not Starting**: Check if haml-lint gem is installed and executable path is correct
2. **Cache Invalidation**: Always update `lastLoadTime` and file `mtimeMs` after successful data load
3. **Disposables**: All subscriptions, watchers, and providers MUST be added to `context.subscriptions` to prevent memory leaks
4. **HAML Syntax**: Pay attention to filter blocks (`:javascript`, `:css`) - they have different indentation rules (see `formatter/index.ts`)
5. **Rails Detection False Negatives**: Some Ruby projects may not have `bin/rails` but still need HAML support

## Key Files Reference

- `src/extension.ts` - Entry point, activation/deactivation
- `src/ExtensionActivator.ts` - Feature registration hub
- `src/EventSubscriber.ts` - Event coordination and file watching
- `src/server/index.ts` - Ruby server TCP client
- `lib/server.rb` - Ruby server implementation
- `src/linter/index.ts` - Diagnostic management
- `src/formatter/index.ts` - Auto-correction logic
- `src/rails/routes.ts` - Rails routes parser & cache

## Extension Points for New Features

1. **New Language Feature**: Create provider in `src/providers/`, register in `ExtensionActivator`
2. **New Linting Rule**: Extend `lib/lint_server/cops.rb`, add quick fix in `src/quick_fixes/`
3. **New Rails Integration**: Add to `registerRailsProviders()`, use caching pattern from Routes
4. **New Command**: Register in `package.json` → `contributes.commands` and `ExtensionActivator.registerCommands()`

---

**Pro Tips**:

- Use `loadWithProgress()` from `rails/utils.ts` for long operations to show progress indicator
- The Ruby server uses JSON for request/response - see `lib/lint_server/controller.rb` for protocol
- HAML attribute syntaxes: `%div{class: 'foo'}`, `%div(class="foo")`, `%div{:class => 'foo'}` - support all three
