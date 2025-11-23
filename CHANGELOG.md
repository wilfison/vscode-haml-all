# Change Log

## UNRELEASED

- Fix: fix "Go to Definition" provider cursor position over partial strings.

## [2.0.7] - 2025-11-22

- **Performance**: Add intelligent caching for Routes (5min TTL) and I18n locales (10min TTL) with automatic invalidation
- **Testing**: Add 22 RSpec/Minitest snippets for view testing
- **Documentation**: Add `CONTRIBUTING.md` and `docs/ARCHITECTURE.md`
- **Code Quality**: Add JSDoc to public APIs, replace `console.log` with OutputChannel, apply Prettier formatting
- **Error Handling**: Improve user feedback with notifications for critical errors
- **Refactor**: Fix typos in folder names (`ultils` to `utils`), update ESLint and TypeScript configs

## [2.0.6] - 2025-10-10

- Add **I18n Validation Configuration**: New settings to control I18n validation behavior
  - `hamlAll.i18nValidation.enabled`: Enable/disable I18n validation diagnostics (default: true)
  - `hamlAll.i18nValidation.defaultLocale`: Set default locale for I18n validation (auto-detected if empty)
- Better handling of missing locale scenarios
- Enhanced configuration flexibility for different project setups

## [2.0.5] - 2025-09-01

- Fix false positive in `I18nDiagnosticsProvider`.

## [2.0.4] - 2025-08-30

- Update regex for I18n calls to suporte interpolated strings.

## [2.0.3] - 2025-08-23

- Add **Wrap in a Ruby Block**: New Code Action to wrap selected HAML content in Ruby blocks (each, times, etc.)
  - Select any HAML content and use the "Wrap in a ruby block" option from the Code Actions menu
- Refactor: Improve wrap functionality implementation and add better support for empty selections

## [2.0.2] - 2025-08-23

- Add **Wrap in Conditional**: New Code Action to wrap selected HAML content in conditional statements (if/unless blocks)
  - Select any HAML content and use the "Wrap in conditional" option from the Code Actions menu

## [2.0.1] - 2025-08-21

- Fix I18N_CALL_REGEXP to match I18n calls with preceding characters (=, -)

## [2.0.0] - 2025-08-15

- Add **Data Attributes Auto-completion**: Intelligent auto-completion for HTML data attributes including:
  - Common HTML data attributes (`data-toggle`, `data-target`, `data-dismiss`, etc.)
  - Rails UJS attributes (`data-confirm`, `data-method`, `data-remote`, `data-disable-with`, etc.)
  - Turbo Rails attributes (`data-turbo`, `data-turbo-action`, `data-turbo-frame`, `data-turbo-stream`, etc.)
  - Stimulus attributes (`data-controller`, `data-action`, `data-target`, etc.)
- Add **Rails Helpers Support**: Auto-completion works with Rails helpers like `link_to`, `button_to`, `form_with`, `text_field`, etc.
- Add **assets auto-completion** for Rails asset pipeline.
- Add **image preview** with CodeLens support for Rails image helpers.
- Add support for `I18n.t` and `I18n.translate` methods with auto-completion, go to definition and validation.

## [1.2.9] - 2025-08-06

- Refactor: improve lints messagens and rubocop lint url.
- Refactor: update output channel usage and improve logging in various components.

## [1.2.8] - 2025-06-30

- [#6](https://github.com/wilfison/vscode-haml-all/pull/6) `kamen-hursev`: Fix multi-line ruby highlighting

## [1.2.7] - 2025-04-17

- Feat: add timeout handling for autocorrect and improve error logging
- Feat: enhance lintserver to support output channel for improved logging

## [1.2.6] - 2025-04-15

- Feat: implement lint server with autocorrect using `haml_lint` gem.
- Refactor: remove rubocop autoformat without server.

## [1.2.5] - 2025-04-12

- Feat: realtime linter.

## [1.2.4] - 2025-04-10

- Fix: formating bug when have `$` sign in string.
- Feat: implement event subscription management in extensionactivator

## [1.2.3] - 2025-04-08

- Fix: handle loaderror for `haml_lint` dependency
- Fix: handle errors during haml lint server startup and improve logging
- Fix: update diagnostics on linter server start
- Refactor: remove deprecated haml compilation code

## [1.2.2] - 2025-04-05

- Feat: add `CodeLens` support for navigating to controller actions.

## [1.2.1] - 2025-04-02

- Feat: create background server for haml-lint to improve performance.

## [1.1.9] - 2025-03-28

- Fix: update regex for unnecessary string output and enhance test cases
- Fix: update regex to support quoted keys in rubocop cops formatter

## [1.1.8] - 2025-03-23

- Fix: add check for rails project path before loading routes
- Fix: resolve go to definition with multi projects/workspaces.
- Fix: sanitize stdout before checking route prefix

## [1.1.7] - 2025-03-07

- Fix: methodcallwithargsparentheses formatter one line scripts

## [1.1.6] - 2025-02-25

- Add default haml lint configuration, prevent missing new cops
- Feat: add support for `StrictLocals` cop

## [1.1.5] - 2025-02-24

- Feat: add partialsignaturehelpprovider for enhanced signature help when use `render` method.
  - obs: only works if partial has `locals` comment.
- Feat: add switch quotes action action.
- Fix: adjust position for inserting disable comment.
- Fix: update haml configuration to enhance string handling and indentation rules

## [1.1.4] - 2025-02-22

- Fix: grammar haml block comment syntax.
- Feat: refactor lint configuration loading and improve error notifications

## [1.1.3] - 2025-02-21

- Feat: refactor linter diagnostics to prevent duplicated diagnostics for the same line.
- Fix: trim whitespace from empty lines.
- Fix: update regex to support unicode letters in string output.
- Fix: remove indentation from json output in linter logging.

## [1.1.2] - 2025-02-21

- Feat: refactor formaters to better performance.
- Fix: fix `HamlLint: SpaceBeforeScript` cop autocorrect.

## [1.1.1] - 2025-02-18

- Feat: refactor lint offense handling and enabling clickable links to documentation.

## [1.1.0] - 2025-02-18

- Feat: add support for `UnnecessaryStringOutput` linting rule.
- Feat: improve space handling for Ruby script indicators in Haml formatter.
- Fix: load config by preload bundle config in rails projects.

## [1.0.9] - 2025-02-15

- Bugfix: Fix command execution when `useBundler` is `true`.

## [1.0.8] - 2025-01-17

- Feat: Add rubocop support to haml_lint configuration enabling rubocop cops

## [1.0.7] - 2025-01-16

- Bugfix: Altocorrenction to rubocop Layout/SpaceAfterColon when call class constants.

## [1.0.6] - 2024-12-12

- Feat: Add support to 'Style/MethodCallWithArgsParentheses' cop. Only add parentheses around method calls with arguments when there are no parentheses.

## [1.0.5] - 2024-12-07

- Fix: update regex for space handling after colon and add test for space inside parentheses.
- Feat: Implement file watching for live preview updates in HAML files

## [1.0.4] - 2024-12-05

- Feature: Add Live Preview for HAML plain files.

## [1.0.3] - 2024-12-02

- Bugfix: Fix locals comments in `Split to Partial` command.
- Formatter: Add support to haml-lint `HtmlAttributes`

## [1.0.2] - 2024-11-27

- Formatter: Add support to rubocop `Layout/SpaceBeforeComma`
- Formatter: Add support to rubocop `Layout/SpaceAfterColon`
- Bugfix: Fix `Style/StringLiterals` with interpolation.

## [1.0.1] - 2024-11-26

- Bugfix: Fix HAML formatter block comments.
- Update haml grammar from [textmate-grammars-themes](https://github.com/shikijs/textmate-grammars-themes/blob/main/packages/tm-grammars/grammars/haml.json)

## [1.0.0] - 2024-11-24

- Feature: [Add FormattingEditProvider](https://github.com/wilfison/vscode-haml-all/pull/1)
  - Add HAML formatter (Code Beautifier).

## [0.0.9] - 2024-11-22

- Fix: icon background color.

## [0.0.8] - 2024-11-22

- Update extension description and enhance README with feature details and future plans.
- Update icon.

## [0.0.7] - 2024-11-18

- Fix: Rails routes loader to old Rails versions.

## [0.0.6] - 2024-11-17

- Feature: Add suporte to convert selected HTML/ERB to HAML.

## [0.0.5] - 2024-11-16

- Feature: Add Routes Completions if the project is a Rails project.
- Feature: Add Routes Definition provider if the project is a Rails project.

## [0.0.4] - 2024-11-12

- Feature: Add `Html2Haml` command to convert HTML to Haml.
- Linter: Add autocorrect action for `HamlLint: SpaceBeforeScript` cop.
- Linter: Add autocorrect action for `RuboCop: Layout/SpaceInsideHashLiteralBraces` cop.

## [0.0.3] - 2024-11-09

- Linter: Add autocorrect action for `RuboCop: String/StringLiterals` cop.

## [0.0.2] - 2024-11-09

### Split to Partial

- `Strict template locals`: change global variables to locals when creating a partial from selection.

## [0.0.1] - 2024-11-09

- Initial release

## [Unreleased]

- Initial release
