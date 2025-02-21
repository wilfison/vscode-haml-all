import Linter from '../linter';
import { HAML_FILTERS } from '../ultils/haml';

import hamlFixes, { HamlLintFixer, linter_cops } from './haml_lint_cops';
import { RuboCopFixer, rubocops } from './rubocop_cops';

function isFilter(line: string): boolean {
  const filter = line.trim().match(/^:(\w+)$/);

  return filter ? HAML_FILTERS.includes(filter[1]) : false;
}

function lineIdent(line: string): number {
  return (line.match(/^\s*/)?.[0] || '').length;
}

export default function autoCorrectAll(text: string, linter: Linter): string {
  const hamlLintConfig = linter.hamlLintConfig;
  const rubocopConfig = linter.rubocopConfig;

  let hamlFixers: HamlLintFixer[] = [];
  let rubocopFixers: RuboCopFixer[] = [];

  if (hamlLintConfig) {
    linter_cops.forEach(([copName, fixer]) => {
      if (hamlLintConfig[copName].enabled) {
        hamlFixers.push(fixer);
      }
    });
  }

  // Only run RuboCop fixes if RuboCop is enabled in the Haml-Lint config
  if (hamlLintConfig?.RuboCop.enabled && rubocopConfig) {
    const ignoredCops = hamlLintConfig.RuboCop.ignored_cops;

    rubocops.forEach(([copName, fixer]) => {
      if (rubocopConfig[copName].Enabled && !ignoredCops.includes(copName)) {
        rubocopFixers.push(fixer);
      }
    });
  }

  let insideFilter = false;
  let filterIdent = 0;

  const fixedText = text.split('\n').map(line => {
    if (line.trim() === '') {
      return line.trim();
    }

    if (insideFilter) {
      insideFilter = lineIdent(line) > filterIdent;
      filterIdent = insideFilter ? filterIdent : 0;
    }

    if (insideFilter) {
      return line.trimEnd();
    }

    if (isFilter(line)) {
      insideFilter = true;
      filterIdent = lineIdent(line);
      return line.trimEnd();
    }

    let fixedLine = line.trimEnd();

    if (rubocopConfig) {
      rubocopFixers.forEach((fixer) => {
        fixedLine = fixer(fixedLine, rubocopConfig);
      });
    }

    if (hamlLintConfig) {
      hamlFixers.forEach((fixer) => {
        fixedLine = fixer(fixedLine, hamlLintConfig);
      });
    }

    return fixedLine;
  }
  ).join('\n');

  return hamlFixes.fixFinalNewline(fixedText, hamlLintConfig);
}
