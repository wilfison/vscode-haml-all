# Contributing to HAML All-in-One

Thank you for your interest in contributing to HAML All-in-One! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful and constructive in all interactions.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Create a new branch for your changes
4. Make your changes
5. Test your changes
6. Submit a pull request

## Development Setup

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **VS Code**: Latest stable version
- **Ruby**: Version 2.7 or higher (for testing HAML features)
- **haml-lint gem**: `gem install haml_lint`

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/vscode-haml-all.git
cd vscode-haml-all

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes (recommended during development)
npm run watch
```

### Running the Extension

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. A new VS Code window will open with the extension loaded
4. Open a HAML file to test the extension features

## Project Structure

```
vscode-haml-all/
├── src/                      # TypeScript source code
│   ├── extension.ts          # Extension entry point
│   ├── ExtensionActivator.ts # Feature registration
│   ├── providers/            # Language feature providers
│   │   ├── i18n/             # I18n-related providers
│   │   └── *.ts              # Completion, hover, definition providers
│   ├── formatter/            # Code formatting
│   ├── linter/               # Linting integration
│   ├── rails/                # Rails-specific features
│   ├── server/               # Ruby server integration
│   ├── utils/                # Utility functions
│   └── test/                 # Unit tests
├── lib/                      # Ruby server code
├── snippets/                 # Code snippets
├── syntaxes/                 # TextMate grammar
└── package.json              # Extension manifest

```

### Key Components

- **Providers**: Implement VS Code language features (completion, hover, definition, etc.)
- **Linter**: Integrates with haml-lint for code quality
- **Formatter**: Auto-formatting using haml-lint autocorrect
- **Server**: Ruby-based TCP server for efficient linting
- **Rails Integration**: Routes, I18n, partials, and assets support

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(i18n): add hover provider for translation keys

fix(linter): handle server connection errors gracefully

docs(contributing): add development setup instructions
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --grep "I18nCompletionProvider"

# Run tests in watch mode
npm run watch
```

### Writing Tests

Tests are located in `src/test/`. We use Mocha and VS Code's test framework.

Example test structure:

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import MyProvider from '../providers/MyProvider';

suite('MyProvider Test Suite', () => {
  test('should provide completions', async () => {
    const provider = new MyProvider();
    const document = await vscode.workspace.openTextDocument({
      language: 'haml',
      content: 'sample content',
    });

    const position = new vscode.Position(0, 0);
    const result = await provider.provideCompletionItems(document, position);

    assert.ok(result);
    assert.strictEqual(result.length > 0, true);
  });
});
```

### Test Coverage

Aim for at least 80% code coverage on new features. Run coverage reports with:

```bash
npm run test:coverage  # Coming soon
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Follow ESLint and Prettier configurations
- Add JSDoc comments for public APIs
- Use meaningful variable and function names

### Formatting

```bash
# Format code
npm run format

# Check formatting
npm run format:check

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Best Practices

1. **Type Safety**: Always use proper TypeScript types
2. **Error Handling**: Use try-catch blocks and provide user feedback
3. **Resource Management**: Dispose of resources properly (subscriptions, watchers)
4. **Performance**: Cache expensive operations (routes, locales)
5. **Logging**: Use OutputChannel instead of console.log

## Submitting Changes

### Pull Request Process

1. **Update your branch** with the latest changes from `main`:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Ensure all tests pass**:

   ```bash
   npm test
   ```

3. **Lint and format your code**:

   ```bash
   npm run lint:fix
   npm run format
   ```

4. **Update documentation** if needed

5. **Create a pull request** with:
   - Clear title and description
   - Reference to related issues
   - Screenshots/GIFs for UI changes
   - List of changes made

### Pull Request Checklist

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] JSDoc comments added for public APIs
- [ ] README updated (if needed)
- [ ] CHANGELOG updated (if applicable)
- [ ] No breaking changes (or documented if necessary)

## Reporting Bugs

### Before Submitting

1. Check if the bug has already been reported
2. Verify it's not a configuration issue
3. Test with the latest version

### Bug Report Template

```markdown
**Description**
A clear description of the bug.

**Steps to Reproduce**

1. Step one
2. Step two
3. ...

**Expected Behavior**
What should happen.

**Actual Behavior**
What actually happens.

**Environment**

- OS: [e.g., macOS 14.0]
- VS Code Version: [e.g., 1.85.0]
- Extension Version: [e.g., 2.0.6]
- Ruby Version: [e.g., 3.2.0]
- haml-lint Version: [e.g., 0.50.0]

**Additional Context**
Screenshots, logs, or other relevant information.
```

## Suggesting Features

We welcome feature suggestions! Please:

1. Check if the feature has already been requested
2. Provide a clear use case
3. Describe the expected behavior
4. Consider implementation complexity

### Feature Request Template

```markdown
**Feature Description**
A clear description of the feature.

**Use Case**
Why is this feature useful?

**Proposed Solution**
How should this feature work?

**Alternatives Considered**
What other approaches did you consider?

**Additional Context**
Any other relevant information.
```

## Architecture Guidelines

### Adding a New Provider

1. Create the provider class in `src/providers/`
2. Implement the appropriate VS Code provider interface
3. Add JSDoc documentation
4. Register the provider in `ExtensionActivator.ts`
5. Add tests in `src/test/providers/`
6. Update documentation

### Adding Cache Support

When adding caching:

1. Track file modification times
2. Implement `isCacheValid()` method
3. Set reasonable TTL (Time To Live)
4. Clear cache when files change
5. Log cache hits/misses to OutputChannel

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [HAML Documentation](https://haml.info/)
- [Rails Documentation](https://guides.rubyonrails.org/)

## Questions?

If you have questions:

- Open a [GitHub Discussion](https://github.com/wilfison/vscode-haml-all/discussions)
- Check existing [Issues](https://github.com/wilfison/vscode-haml-all/issues)
- Review the [README](README.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to HAML All-in-One! 🎉
