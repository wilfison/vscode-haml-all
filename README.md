<h1 align="center">HAML - All in One</h1>

<p align="center">
  Syntax highlighting, linting, formatting and Rails-aware navigation for HAML, in one extension.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=wilfison.haml-all"><img src="https://img.shields.io/visual-studio-marketplace/v/wilfison.haml-all?style=flat-square&label=marketplace" alt="Marketplace version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=wilfison.haml-all"><img src="https://img.shields.io/visual-studio-marketplace/i/wilfison.haml-all?style=flat-square" alt="Installs"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=wilfison.haml-all"><img src="https://img.shields.io/visual-studio-marketplace/r/wilfison.haml-all?style=flat-square" alt="Rating"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License"></a>
</p>

![Linting preview](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/preview/linter.gif)

## Quick start

1. Install the extension from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=wilfison.haml-all).
2. Add the linting gems to your `Gemfile` (only needed for linting and formatting):

   ```ruby
   group :development, :test do
     gem 'rubocop'
     gem 'haml-lint', require: false
   end
   ```

   ```shell
   bundle install
   ```

3. Open a `.haml` file and **trust the workspace** when VS Code asks. Highlighting, snippets and completions work without it; anything that runs your project's Ruby does not. See [Workspace Trust](#workspace-trust).

Using a `Gemfile`? Turn on `hamlAll.useBundler` so the linter runs through `bundle exec`.

## Features

| Feature | Requires |
| --- | --- |
| [Syntax highlighting](#syntax-highlighting) | None |
| [Linting & diagnostics](#linting) | `haml-lint` |
| [Formatting & auto-correction](#formatting-and-auto-correction) | `haml-lint`, `rubocop` |
| [Quick fixes](#quick-fixes) | `haml-lint` |
| [Partials: go to definition](#partials-go-to-definition) | None |
| [Partials: completion & signature help](#partials-completion-and-signature-help) | None |
| [Extract to partial](#extract-to-partial) | None |
| [Wrap in conditional / Ruby block](#wrap-in-conditional-or-ruby-block) | None |
| [Data attribute completion](#data-attribute-completion) | None |
| [Asset completion & navigation](#assets-and-image-preview) | Rails project |
| [Image preview](#assets-and-image-preview) | None |
| [Jump to controller](#jump-to-controller) | Rails project |
| [Routes: completion & go to definition](#rails-routes) | Rails project |
| [HTML/ERB → HAML conversion](#convert-htmlerb-to-haml) | `html2haml` |
| [Snippets](#snippets) | None |

Rails-only features activate when `bin/rails` exists in the workspace. Everything else works in any project with HAML files.

## Commands

Open the Command Palette (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>):

| Command | Description |
| --- | --- |
| `HAML: Create a partial from selection` | Moves the selection into a new partial and replaces it with `render`. |
| `HAML: Wrap in conditional` | Wraps the selection in `- if …`. |
| `HAML: Wrap in a ruby block` | Wraps the selection in a Ruby block. |
| `HAML: Convert HTML to HAML` | Converts the current HTML/ERB file with `html2haml`. |
| `HAML: Restart lint server` | Restarts the Ruby lint server and resets the auto-restart counter. |
| `HAML: Show output` | Opens the **Haml** output channel. |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `hamlAll.lintEnabled` | `true` | Enable haml-lint diagnostics. |
| `hamlAll.lintOnType` | `true` | Lint while typing (debounced). When `false`, files are linted on open and save only. |
| `hamlAll.useBundler` | `false` | Run haml-lint through `bundle exec`. Makes `linterExecutablePath` irrelevant. |
| `hamlAll.linterExecutablePath` | `haml-lint` | Used **only** to check that haml-lint is available. Linting itself runs through `hamlAll.rubyCommand`. |
| `hamlAll.rubyCommand` | `ruby` | Ruby interpreter that runs the lint server. May include arguments. |
| `hamlAll.railsCommand` | `bin/rails` | Command used for Rails detection and `rails routes`. May include arguments, e.g. `bundle exec rails`. |

```jsonc
{
  "hamlAll.useBundler": true,
  "hamlAll.lintOnType": false,
  // Absolute path helps when rbenv/asdf/mise shims are not on the PATH of a
  // VS Code launched from the dock or start menu.
  "hamlAll.rubyCommand": "/home/me/.rbenv/shims/ruby"
}
```

Changing `hamlAll.useBundler` or `hamlAll.rubyCommand` restarts the lint server immediately, with no window reload.

> **Machine-scoped settings.** `hamlAll.linterExecutablePath`, `hamlAll.rubyCommand` and `hamlAll.railsCommand` can only be set in your **user** settings, never by a repository's `.vscode/settings.json`. They name an executable, and a cloned repo should not be able to choose it.

> `railsRoutes.railsCommand` is deprecated in favour of `hamlAll.railsCommand`. It is still read when the new setting is unset.

## Features in depth

### Syntax highlighting

A HAML grammar covering tags, attributes in all three syntaxes, Ruby lines, and filters (`:ruby`, `:javascript`, `:css`, `:erb`, `:preserve`, `:escaped`, `:cdata`, `:markdown`, `:less`, …), each highlighted with its own embedded language.

Editing behaviour matches HAML too: Enter indents only where HAML actually nests (after a block, a `do`, an empty tag, a filter), `- else` / `- elsif` / `- when` / `- rescue` / `- ensure` / `- end` outdent, and double-click selects `data-controller`, `@user` or `root_path` as a single word.

### Linting

Diagnostics come from [haml-lint](https://github.com/sds/haml-lint) (which uses RuboCop under the hood), served by a persistent Ruby process so that linting while typing stays fast.

Configure it with a `.haml-lint.yml` and a `.rubocop.yml` in your project root. See haml-lint's [default configuration](https://github.com/sds/haml-lint/blob/main/config/default.yml). Editing `.haml-lint.yml` reloads it without a restart.

While a `.haml` file is open, a **HAML** status bar item reports the lint server: `$(sync~spin)` starting, `$(check)` running, `$(warning)` failed or gem missing, with the reason in the tooltip. Clicking it opens the **Haml** output channel.

**Multi-root workspaces:** every folder gets its own lint server, so each uses its own `Gemfile`, working directory and `.haml-lint.yml`. Rails routes and asset completion use the first folder.

### Formatting and auto-correction

`Format Document` (and `editor.formatOnSave`) runs haml-lint's **safe** autocorrect over the whole file. The same correction is exposed as a `source.fixAll` action, so it can also run on save without `editor.formatOnSave`:

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.hamlLint": "explicit"
  }
}
```

- Pick one of the two. With `editor.formatOnSave` also on, the autocorrect runs twice per save; the second pass changes nothing but costs a round-trip.
- Large files with heavy RuboCop cops may need a higher `editor.codeActionsOnSaveTimeout` (VS Code defaults to 750 ms); on timeout the file is saved unchanged.
- Every correction comes from the installed haml-lint. Its own linters (`TrailingWhitespace`, `ClassesBeforeIds`, `HtmlAttributes`, …) are autocorrected from `haml_lint` 0.74.0 on; with an older gem only RuboCop offenses are fixed, and the extension says so once per session.

### Quick fixes

The lightbulb on an offense offers:

- **Fix all `<Linter>` offenses in this file**: haml-lint corrects per linter, not per line, so the whole file is corrected for that linter (for a RuboCop offense: for every RuboCop cop). Unlike formatting, this is an explicit ask and also applies corrections marked **unsafe**. Needs the `correctable` flag reported by `haml_lint` 0.76.0+.
- **Disable `<Rule>` for this entire file**: inserts the right directive, including `-# haml-lint:disable RuboCop` for RuboCop offenses.
- Targeted fixes for `Style/StringLiterals`, `Layout/SpaceInsideHashLiteralBraces` and `SpaceBeforeScript`.

### Partials: go to definition

<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + click a partial name, or use **Go to Definition**.

Every way Rails names a partial is understood: `render "shared/header"`, `render partial: "row"`, `render "row"` (next to the current view), `render @user` and `render @users, collection: …`. When a partial exists in several templates (`_row.html.haml` next to `_row.turbo_stream.haml`, or a `+mobile` variant), all of them are offered. Partials under **any** `app/views` directory in the workspace are found, including an engine kept in the repository.

![Go to definition](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/preview/go-to-definition.gif)

### Partials: completion and signature help

Typing `render "` completes from an index of every partial in the workspace, sorted by proximity to the current view. The index is built once and refreshed when partials are added or removed, so there is no workspace scan per keystroke.

Inside `render "form", ` the signature help shows the partial's `-# locals: (user:, title: nil)` declaration and highlights the argument you are typing.

![Partial completion](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/preview/partial-completion.gif)

### Extract to partial

Select the content, open the Code Actions menu (lightbulb) and choose **Create a partial from selection**. The extension writes the new file, infers its `locals` from the selection, and replaces the selection with the matching `render`.

The name accepts a path: `shared/foo` creates `app/views/shared/_foo.html.haml`.

![Extract to partial](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/preview/partial-from-selection.gif)

### Wrap in conditional or Ruby block

Select any content and pick **Wrap in conditional** from the Code Actions menu. You are asked for the condition:

```haml
%div.user-info
  %h2= @user.name
```

becomes

```haml
- if @user.present?
  %div.user-info
    %h2= @user.name
```

**Wrap in a ruby block** does the same with an iteration block.

### Data attribute completion

Start typing `data-` in any attribute context to get suggestions with descriptions for:

- **HTML**: `data-toggle`, `data-target`, `data-dismiss`, …
- **Rails UJS**: `data-confirm`, `data-method`, `data-remote`, `data-disable-with`, …
- **Turbo**: `data-turbo`, `data-turbo-action`, `data-turbo-frame`, `data-turbo-stream`, …
- **Stimulus**: `data-controller`, `data-action`, `data-target`, …

All three HAML attribute syntaxes work, and so does a project without Rails:

```haml
%div{data_confirm: "Are you sure?"}
%form(data_remote: true, data_turbo_action: "replace")
%button{:data_disable_with => "Processing..."}
```

### Assets and image preview

Inside `image_tag`, `javascript_include_tag`, `stylesheet_link_tag`, `asset_path` and the pack/vite helpers, quoted paths are completed from an in-memory index of your asset directories (Sprockets, Webpacker, Propshaft, Vite and `public/` layouts are all covered). **Go to Definition** opens the file.

A CodeLens above any image helper previews the image without leaving the editor.

### Jump to controller

A CodeLens at the top of a view links to the action that renders it (or to the controller, for a partial).

### Rails routes

Route helpers are completed from `rails routes`, both inside helpers like `link_to` and while typing the helper itself: `posts_pa` offers `posts_path`. **Go to Definition** on a helper jumps to the controller action, engines included.

Routes are cached and reloaded when `config/routes.rb` or `config/routes/**/*.rb` changes.

### Convert HTML/ERB to HAML

```shell
gem install html2haml
```

Open an HTML or ERB file and run **HAML: Convert HTML to HAML**. The converted file is written next to the original with a `.haml` extension.

### Snippets

- **HAML**: `!html5`, `- if`, `- unless`, `- else`, `each`, `:ruby`, `:javascript`, `:css`.
- **Rails**: ~200 snippets for view helpers: form builders (`= f.text_field`, `= form_with`), links and buttons, `= content_tag`, caching (`- cache`), asset helpers, and more.
- **Ruby (tests)**: view spec helpers for RSpec and Minitest (`rspec_view`, `minitest_render_partial`, `test_turbo_frame`, `stub_helper`, …), available in `.rb` files.

## Workspace Trust

In a workspace you have not trusted, the extension keeps syntax highlighting, snippets, completions and go-to-definition working, and disables everything that runs your project's Ruby:

- Linting and diagnostics (haml-lint / RuboCop)
- Formatting and quick fixes
- Rails routes completion and go to definition
- `HAML: Convert HTML to HAML`

This is deliberate: `bin/rails`, the `Gemfile`, and a `require:` directive in `.haml-lint.yml` are code from the repository. Trusting the folder enables them immediately, with no window reload. For the same reason `hamlAll.useBundler` is ignored when it comes from an untrusted workspace's `.vscode/settings.json`.

## Troubleshooting

Start with **HAML: Show output**. The **Haml** channel logs the lint server's start-up, every request and every failure.

| Symptom | Fix |
| --- | --- |
| "haml-lint not found" | Install the gem, or turn on `hamlAll.useBundler` if it only lives in your bundle. |
| Status bar shows `$(warning)` | Read the tooltip, then run **HAML: Restart lint server**. |
| Server will not start, Ruby is installed | Your version manager's shims are not on VS Code's PATH. Set `hamlAll.rubyCommand` to an absolute path. |
| No diagnostics at all | Check `hamlAll.lintEnabled`, and that the workspace is trusted. |
| Format on save does nothing on big files | Raise `editor.codeActionsOnSaveTimeout`. |
| Nothing but highlighting works | The workspace is in Restricted Mode. See [Workspace Trust](#workspace-trust). |

## Contributing

Bug reports, feature requests and pull requests are welcome at [wilfison/vscode-haml-all](https://github.com/wilfison/vscode-haml-all). See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development setup, and [CHANGELOG.md](./CHANGELOG.md) for release notes.

## Recommended extensions

- [Ruby LSP](https://marketplace.visualstudio.com/items?itemName=Shopify.ruby-lsp): Ruby language support.
- [One Dark Dracula](https://marketplace.visualstudio.com/items?itemName=wilfison.one-dark-dracula): a theme tuned for this extension's highlighting.

## Acknowledgments

Thanks to these projects for inspiration and functionality, all MIT licensed:

[Better HAML](https://github.com/karuna/haml-vscode/) ·
[Rails Open Partial](https://github.com/shanehofstetter/rails-open-partial-vscode) ·
[HAML Lint](https://github.com/aki77/vscode-haml-lint) ·
[Rails Partial](https://github.com/aki77/vscode-rails-partial) ·
[Rails Routes](https://github.com/aki77/vscode-rails-routes)

## License

[MIT](./LICENSE)
