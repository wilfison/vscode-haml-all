import Linter from '../linter';

import haml from './haml_lint_cops';
import rubocop from './rubocop_cops';

export default function autoCorrectAll(text: string, linter: Linter): string {
  const hamlLintConfig = linter.hamlLintConfig;
  const rubocopConfig = linter.rubocopConfig;

  let fixedText = text;

  if (hamlLintConfig) {
    fixedText = haml.fixTrailingWhitespace(fixedText, hamlLintConfig);
    fixedText = haml.fixTrailingEmptyLines(fixedText, hamlLintConfig);
    fixedText = haml.fixFinalNewline(fixedText, hamlLintConfig);
    fixedText = haml.fixClassBeforeId(fixedText, hamlLintConfig);
    fixedText = haml.fixSpaceBeforeScript(fixedText, hamlLintConfig);
    fixedText = haml.fixLeadingCommentSpace(fixedText, hamlLintConfig);
    fixedText = haml.fixHtmlAttributes(fixedText, hamlLintConfig);
  }

  if (rubocopConfig) {
    fixedText = rubocop.fixStringLiterals(fixedText, rubocopConfig);
    fixedText = rubocop.fixSpaceInsideParens(fixedText, rubocopConfig);
    fixedText = rubocop.fixSpaceBeforeComma(fixedText, rubocopConfig);
    fixedText = rubocop.fixSpaceAfterColon(fixedText, rubocopConfig);
    fixedText = rubocop.fixMethodCallWithArgsParentheses(fixedText, rubocopConfig);
  }

  return fixedText;
}
