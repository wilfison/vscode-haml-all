# HAML - All in One

A powerful VS Code extension providing essential tools for efficient and seamless HAML development.

[![VSCode Marketplace](https://img.shields.io/vscode-marketplace/v/wilfison.haml-all.svg?style=flat-square&label=vscode%20marketplace)](https://marketplace.visualstudio.com/items?itemName=wilfison.haml-all) [![Total Installs](https://img.shields.io/vscode-marketplace/d/wilfison.haml-all.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=wilfison.haml-all) [![Average Rating](https://img.shields.io/vscode-marketplace/r/wilfison.haml-all.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=wilfison.haml-all)

![Linting Preview](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/preview/linter.gif)

## Features

The following features are supported to make your HAML development effortless:

| Status | Feature                    | Requirement/Infos                                    |
| ------ | -------------------------- | ---------------------------------------------------- |
| ✅     | Syntax Highlighting        |                                                      |
| ✅     | Linter                     | Rquire `haml_lint` gem                               |
| ✅     | HAML Formatter             | Rquires `haml_lint` e `rubocop` gems                 |
| ✅     | Partial: Go to Definition  |                                                      |
| ✅     | Partial: Autocompletion    |                                                      |
| ✅     | Data Attributes Completion | HTML, Rails UJS, Turbo Rails & Stimulus              |
| ✅     | Routes: Autocompletion     | Rails Project                                        |
| ✅     | Routes: Go to Definition   | Rails Project                                        |
| ✅     | Split to Partial           |                                                      |
| ✅     | Convert HTML/ERB to HAML   | [`html2haml`](https://github.com/haml/html2haml) gem |
| ✅     | Snippets - HAML            |                                                      |
| ✅     | Snippets - Rails           |                                                      |
| ✅     | Live Preview               | Use `HAML: Open Live Preview` command                |

---

## Linting

This extension utilizes the `haml-lint` and `rubocop` gems for linting HAML files.
To configure, create a `.haml-lint.yml` and `.rubocop` files in your project root. Check the [default configuration](https://github.com/sds/haml-lint/blob/main/config/default.yml).

**To install the gem, add this to your `Gemfile`:**

```ruby
group :development, :test do
  gem 'rubocop'
  gem 'haml-lint', require: false
end
```

---

## Features in Depth

### Partials - Go to Definition

Navigate to a partial file by using `CTRL + Click` on the partial name or right-click and select `Go to Definition`.

![Go to Definition](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/preview/go-to-definition.gif)

### Partials - Split to Partial

Easily extract content into a new partial. Select the content, click the `Create a partial from selection` option in the Code Actions menu (lightbulb icon), and you're done!

![Split to Partial](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/preview/partial-from-selection.gif)

### Partial Completion

Autocomplete for partials based on the `app/views` directory in your project.

![Partial Completion](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/preview/partial-completion.gif)

### Data Attributes Completion

Smart autocompletion for HTML data attributes, with specific support for:

- **HTML Common Attributes**: `data-toggle`, `data-target`, `data-dismiss`, etc.
- **Rails UJS**: `data-confirm`, `data-method`, `data-remote`, `data-disable-with`, etc.
- **Turbo Rails**: `data-turbo`, `data-turbo-action`, `data-turbo-frame`, `data-turbo-stream`, etc.
- **Stimulus**: `data-controller`, `data-action`, `data-target`, etc.

Works with all HAML attribute syntaxes:

```haml
%div{data_confirm: "Are you sure?"}
%form(data_remote: true, data_turbo_action: "replace")
%button{:data_disable_with => "Processing..."}
```

Simply start typing `data-` in any attribute context and get intelligent suggestions with descriptions.

### Convert HTML/ERB to HAML

Convert existing HTML or ERB files to HAML using `html2haml`.

**Installation:**

```shell
gem install html2haml
```

**Usage:**

1. Open an HTML or ERB file.
2. Open the Command Palette (`CTRL + SHIFT + P`).
3. Search for `HAML: Convert HTML to HAML` and select it.
4. Watch the magic happen!

---

## Configuration

You can customize this extension by creating a `.vscode/settings.json` file in your project root:

```json
{
  "hamlAll.lintEnabled": true,

  // Use 'bundle exec' to run haml-lint.
  // (If true, the 'linterExecutablePath' setting is ignored.)
  "hamlAll.useBundler": false,

  // Specify the path to the haml-lint executable.
  "hamlAll.linterExecutablePath": "haml-lint"
}
```

---

## Recommended Extensions

Enhance your experience with these complementary extensions:

- [One Dark Dracula](https://marketplace.visualstudio.com/items?itemName=wilfison.one-dark-dracula): A vibrant dark theme that pairs beautifully with this extension's syntax highlighting.
- [Ruby LSP](https://marketplace.visualstudio.com/items?itemName=Shopify.ruby-lsp): Provides robust Ruby language support.

---

## Acknowledgments

Special thanks to these extensions for inspiration and functionality:

- [Better HAML](https://github.com/karuna/haml-vscode/) (MIT License)
- [Rails Open Partial](https://github.com/shanehofstetter/rails-open-partial-vscode) (MIT License)
- [HAML Lint](https://github.com/aki77/vscode-haml-lint) (MIT License)
- [Rails Partial](https://github.com/aki77/vscode-rails-partial) (MIT License)
- [Rails Routes](https://github.com/aki77/vscode-rails-routes) (MIT License)

---

## License

This extension is released under the [MIT License](./LICENSE).
