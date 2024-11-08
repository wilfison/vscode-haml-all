# HAML - All in One

![HAML - All in One](https://github.io/wilfison/vscode-haml-all/refs/heads/main/images/icon.svg)

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
You can configure the `haml-lint` gem by creating a `.haml-lint.yml` file in the root of your project. Clique [here](https://github.com/sds/haml-lint/blob/main/config/default.yml) to see the default configuration.

To install the `haml-lint` gem, run the following command:

```shell
gem install haml_lint
```

Or add the following line to your Gemfile:

```ruby
gem 'haml_lint'
```

### Partials - Go to definition

This feature allows you to navigate to the partial file by `CTRL + Clicking` on the partial name. Or you can right-click on the partial name and select `Go to definition`.

## Configuration

You can configure the extension by creating a `.vscode/settings.json` file in the root of your project.

```json
{
  "hamlAll.lintEnabled": true,

  // Use 'bundle exec' to run haml-lint
  // (If this is true, the 'linterExecutablePath' setting is ignored.)
  "hamlAll.useBundler": false,

  // Path to haml-lint executable
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
