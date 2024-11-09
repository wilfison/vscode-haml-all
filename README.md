# HAML - All in One

![HAML - All in One](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/icon.png)

Extension to provides syntax highlighting, linting, go to definition, and snippets for Ruby Haml files in VS Code.

## Features

| Feature             | Status |
| ------------------- | ------ |
| Syntax highlighting | 🗹      |
| Linter              | 🗹      |
| Go to definition    | 🗹      |
| Completion          | 🗹      |
| Split to Partial    | 🗹      |
| Snippets - HAML     | 🗹      |
| Snippets - Rails    | 🗹      |

### Linting

It uses the `haml-lint` gem to lint the files.

![Linting](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/linter.gif)

You can configure the gem by creating a `.haml-lint.yml` file in the root of your project. Clique [here](https://github.com/sds/haml-lint/blob/main/config/default.yml) to see the default configuration.

To install the `haml-lint` gem, add the following line to your Gemfile:

```ruby
group :development do
  gem 'haml-lint'
end
```

### Partials - Go to definition

This feature allows you to navigate to the partial file by `CTRL + Clicking` on the partial name. Or you can right-click on the partial name and select `Go to definition`.

![Go to definition](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/go-to-definition.gif)

### Partials - Split to Partial

This feature allows you to split the current file into a partial. You can select the content you want to split and click on the `Create a partial from selection` option in Code Actions (lightbulb icon).

![Go to definition](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/partial-from-selection.gif)

### Partial Completion

This feature provides completion for partials in the project. It uses the `app/views` folder as the base path.

![Partial Completion](https://github.com/wilfison/vscode-haml-all/raw/HEAD/images/partial-completion.gif)

## Configuration

You can configure the extension by creating a `.vscode/settings.json` file in the root of your project.

```ruby
{
  "hamlAll.lintEnabled": true,

  # Use 'bundle exec' to run haml-lint
  # (If this is true, the 'linterExecutablePath' setting is ignored.)
  "hamlAll.useBundler": false,

  # Path to haml-lint executable
  "hamlAll.linterExecutablePath": "haml-lint"
}
```

## Recommended Extensions

- [One Dark Dracula](https://marketplace.visualstudio.com/items?itemName=wilfison.one-dark-dracula): A dark theme for Visual Studio Code. Works well with this extension highlighting.
- [Ruby LSP](https://marketplace.visualstudio.com/items?itemName=Shopify.ruby-lsp): Provides Ruby language support.

## Special Thanks

- [Better Haml](https://github.com/karuna/haml-vscode/): (MIT License)
- [Rails Open Partial](https://github.com/shanehofstetter/rails-open-partial-vscode): (MIT License)
- [Haml Lint](https://github.com/aki77/vscode-haml-lint): (MIT License)
- [Rails Partial](https://github.com/aki77/vscode-rails-partial): (MIT License)

## License

This extension is licensed under the [MIT License](./LICENSE).
