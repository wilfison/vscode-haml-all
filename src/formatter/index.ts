import Linter from '../linter';

import { linter_cops } from './haml_lint_cops';
import { rubocops } from './rubocop_cops';

export default function autoCorrectAll(text: string, linter: Linter): string {
  const hamlLintConfig = linter.hamlLintConfig;
  const rubocopConfig = linter.rubocopConfig;

  let fixedText = text;

  if (hamlLintConfig) {
    linter_cops.forEach(([copName, fixer]) => {
      if (!hamlLintConfig[copName].enabled) {
        return;
      }

      fixedText = fixer(fixedText, hamlLintConfig);
    });
  }

  // Only run RuboCop fixes if RuboCop is enabled in the Haml-Lint config
  if (hamlLintConfig?.RuboCop.enabled && rubocopConfig) {
    const ignoredCops = hamlLintConfig.RuboCop.ignored_cops;

    for (const [copName, fixer] of rubocops) {
      if (ignoredCops.includes(copName)) {
        continue;
      }

      fixedText = fixer(fixedText, rubocopConfig);
    }
  }

  return fixedText;
}
