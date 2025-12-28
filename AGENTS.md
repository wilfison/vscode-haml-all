# AI Agent Development Guide

## Project Overview

**HAML All-in-One** is a VS Code extension providing comprehensive HAML development tools including syntax highlighting, linting, formatting, Rails integration (partials, routes, I18n), and HTML/ERB conversion.

### Core Architecture

The extension follows a **provider-based architecture** with three main subsystems:

1. **LSP Client** (`src/lsp/LspManager.ts`): Manages the haml_lsp gem installation and Language Server Protocol client - **provides all linting and formatting**
2. **Event-Driven Features** (`src/EventSubscriber.ts`): Centralized event handling for Rails-specific file watching (routes)
3. **Rails-Aware Features** (`src/rails/`, `src/providers/`): Optional features activated when Rails project detected

### LSP Manager & Client

The LSP Manager (`src/lsp/LspManager.ts`) handles automatic installation and LSP client lifecycle:

- Creates `.haml-lsp/` directory in project root with:
  - `.gitignore` (ignores all contents)
  - `Gemfile` (imports project's Gemfile and adds `gem "haml_lsp"`)
  - `last_updated` (timestamp of last gem update)
  - `README.md` (explains the directory purpose)
- Runs `bundle install` on first activation
- Checks every 24 hours for updates and runs `bundle update haml_lsp` if needed
- Creates a `LanguageClient` from `vscode-languageclient/node`
- Starts LSP server with `bundle exec haml_lsp --use-bundle --enable-lint` (flags based on config)
- Communicates via stdin/stdout using VS Code's Language Client Protocol

**Important**: The LSP path is no longer configurable - it's always managed in `.haml-lsp/`

**Linting & Formatting**: **ALL linting and formatting is now provided by the LSP server** via the `haml_lsp` gem:

- **Linting**: Powered by haml-lint, configured via `.haml-lint.yml` in project root
- **Formatting**: LSP handles `textDocument/formatting` requests using haml-lint auto-correction
- **Code Actions/Quick Fixes**: LSP provides quick fixes for haml-lint offenses
- **Diagnostics**: Real-time diagnostics via LSP `textDocument/publishDiagnostics`

**Deprecated**:

- `lib/server.rb` - Old Ruby TCP server (kept for reference only)
- `src/linter/index.ts` - Local linter (no-op, kept for compatibility)
- `src/formatter/index.ts` - Local formatter (deprecated, not used)
- `src/providers/FixActionsProvider.ts` - Quick fixes now from LSP
- `.haml-lint.yml` file watching - LSP watches this automatically

## Critical Developer Workflows

### Build & Development

```bash
npm run watch          # Auto-compile TypeScript (required for development)
npm run compile        # One-time compilation
npm test               # Run tests (requires compilation first)
```

**Important**: Press `F5` in VS Code to launch Extension Development Host for testing.

### Testing Changes

The extension activates on `onLanguage:haml` event. To test:

1. Ensure watch task is running (`npm run watch` or use task `npm: watch`)
2. Press F5 to launch Extension Development Host
3. Open `.haml` file to trigger activation
4. Check Output Channel "Haml" for logs (`View > Output > Haml`)
5. LSP server logs will also appear in the output channel

**Debugging LSP Issues**: Check the "Haml" output channel for installation logs, bundle output, and LSP client status.

## Project-Specific Patterns

### Provider Registration Pattern

All providers are registered in `ExtensionActivator.ts` with clear separation:

- **HAML-only features**: `registerHamlProviders()` - formatting, partials, code actions
- **Rails features**: `registerRailsProviders()` - routes, I18n, assets (only when `isARailsProject === true`)

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
- **I18n** (`src/providers/i18n/index.ts`): 10-minute TTL + all locale file mtime tracking
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

Watched patterns (Rails-specific only):

- `**/config/routes.rb`, `**/config/routes/**/*.rb` → reload routes
- `**/config/locales/**/*.yml` → reload I18n data (via I18nProvider)

**Note**: `.haml-lint.yml` is watched automatically by the LSP server, not by EventSubscriber.

### Diagnostics Flow

1. **HAML Linting** (via LSP server):
   - Provided entirely by the `haml_lsp` gem running as LSP server
   - Runs automatically on document open, change, and save
   - Uses `textDocument/publishDiagnostics` LSP protocol
   - Reads `.haml-lint.yml` configuration automatically
   - Provides quick fixes via `textDocument/codeAction`
   - **No local linting code** - `src/linter/index.ts` is deprecated

2. **I18n Validation** (`src/providers/i18n/I18nDiagnosticsProvider.ts`):
   - Separate `DiagnosticCollection` for I18n-specific errors
   - Only active when `hamlAll.i18nValidation.enabled === true`
   - Checks for missing translation keys in loaded locales

### Code Actions (Quick Fixes)

Two types of code actions:

1. **Refactor Actions** (`ViewCodeActionProvider`):
   - Extract to partial
   - Wrap in conditional/block
   - Provided by local extension code

2. **Quick Fixes for Linting** (via LSP server):
   - Auto-fix haml-lint offenses
   - Provided by `haml_lsp` gem via `textDocument/codeAction`
   - **Deprecated**: `FixActionsProvider` and `src/quick_fixes/` (kept for reference)
   - LSP server handles all cop-specific fixes automatically

## Integration Points & External Dependencies

### Ruby Dependencies

**Required by LSP Server** (automatically managed in `.haml-lsp/`):

- **haml_lsp** (required): Main LSP server gem - provides all linting, formatting, and diagnostics
- **haml-lint** (dependency of haml_lsp): Linting engine
- **rubocop** (dependency of haml-lint): Used for formatting/auto-correction

**Optional** (for other features):

- **html2haml**: HTML/ERB → HAML conversion (for `hamlAll.html2Haml` command)

The extension automatically creates a Gemfile in `.haml-lsp/` that imports your project's Gemfile and adds `haml_lsp`.

### Rails Integration Points

1. **Routes** (`src/rails/router_parser.ts`): Parses output of `bin/rails routes -E` (expanded format)
2. **I18n**: Reads `config/locales/**/*.yml` files, detects `config.i18n.default_locale` in Rails config
3. **Partials**: Resolves from `app/views/**/*.haml` using workspace file search
4. **Assets**: Suggests paths from `app/assets/images/**`

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
"hamlAll.i18nValidation.enabled": true,
"hamlAll.i18nValidation.defaultLocale": ""  // Auto-detects if empty
```

Access in code:

```typescript
const config = vscode.workspace.getConfiguration('hamlAll');
const isEnabled = config.get<boolean>('lintEnabled', true);
```

Listen for changes:

```typescript
vscode.workspace.onDidChangeConfiguration((event) => {
  if (event.affectsConfiguration('hamlAll.i18nValidation.enabled')) {
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

**Important**: Ruby tests in `test/lib/lint_server/` use Minitest, run with `ruby -Itest test/**/*_test.rb`.

## Common Gotchas

1. **LSP Installation Issues**: The LSP is automatically managed in `.haml-lsp/` - if installation fails, check bundle output in the Output channel
2. **Cache Invalidation**: Always update `lastLoadTime` and file `mtimeMs` after successful data load
3. **Disposables**: All subscriptions, watchers, and providers MUST be added to `context.subscriptions` to prevent memory leaks
4. **HAML Syntax**: Pay attention to filter blocks (`:javascript`, `:css`) - they have different indentation rules (see `formatter/index.ts`)
5. **Rails Detection False Negatives**: Some Ruby projects may not have `bin/rails` but still need HAML support
6. **I18n Key Syntax**: Support both `t('key')` and `t("key")` formats, with dot notation for nested keys
7. **LSP Updates**: The gem auto-updates every 24 hours - update failures are non-blocking and logged to Output channel

## Key Files Reference

**Active Files**:

- `src/extension.ts` - Entry point, activation/deactivation, LSP initialization
- `src/ExtensionActivator.ts` - Feature registration hub
- `src/EventSubscriber.ts` - Rails-specific file watching (routes)
- `src/lsp/LspManager.ts` - **LSP installation, updates, and lifecycle management**
- `src/providers/i18n/index.ts` - I18n feature orchestration
- `src/rails/routes.ts` - Rails routes parser & cache

**Deprecated Files** (kept for reference/compatibility):

- `src/linter/index.ts` - Linting (now via LSP)
- `src/formatter/index.ts` - Formatting (now via LSP)
- `src/providers/FixActionsProvider.ts` - Quick fixes (now via LSP)
- `src/quick_fixes/` - Cop-specific fixes (now via LSP)
- `src/server/index.ts` - Old Ruby TCP client
- `lib/server.rb` - Old Ruby TCP server

## Extension Points for New Features

1. **New Language Feature**: Create provider in `src/providers/`, register in `ExtensionActivator`
2. **New Linting Rule**: Contribute to the `haml_lsp` gem repository - all linting is via LSP
3. **New Rails Integration**: Add to `registerRailsProviders()`, use caching pattern from Routes/I18n
4. **New Command**: Register in `package.json` → `contributes.commands` and `ExtensionActivator.registerCommands()`

---

**Pro Tips**:

- Use `loadWithProgress()` from `rails/utils.ts` for long operations to show progress indicator
- **All linting/formatting is via LSP** - don't try to implement locally
- HAML attribute syntaxes: `%div{class: 'foo'}`, `%div(class="foo")`, `%div{:class => 'foo'}` - support all three
- Check LSP logs in Output channel "Haml" for debugging LSP issues
