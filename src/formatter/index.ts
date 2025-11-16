import Linter from '../linter';
import { HAML_FILTERS } from '../ultils/haml';

import hamlFixes, { HamlLintFixer, linter_cops } from './haml_lint_cops';

function isFilter(line: string): boolean {
  const filter = line.trim().match(/^:(\w+)$/);

  return filter ? HAML_FILTERS.includes(filter[1]) : false;
}

function lineIdent(line: string): number {
  return (line.match(/^\s*/)?.[0] || '').length;
}

export default function autoCorrectAll(fileName: string, text: string, linter: Linter): string {
  const hamlLintConfig = linter.hamlLintConfig;

  let hamlFixers: HamlLintFixer[] = [];

  if (hamlLintConfig) {
    linter_cops.forEach(([copName, fixer]) => {
      if (hamlLintConfig[copName].enabled) {
        hamlFixers.push(fixer);
      }
    });
  }

  let insideFilter = false;
  let filterIdent = 0;

  let fixedText = text
    .split('\n')
    .map((line) => {
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

      if (hamlLintConfig) {
        hamlFixers.forEach((fixer) => {
          fixedLine = fixer(fixedLine, hamlLintConfig);
        });
      }

      return fixedLine;
    })
    .join('\n');

  fixedText = hamlFixes.fixStrictLocals(fileName, fixedText, hamlLintConfig);
  fixedText = hamlFixes.fixFinalNewline(fixedText, hamlLintConfig);

  return fixedText;
}
