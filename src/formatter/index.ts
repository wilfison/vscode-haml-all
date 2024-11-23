import Linter from '../linter';
import { LinterConfig } from '../types';

export default function autoCorrectAll(text: string, linter: Linter): string {
  const hamlLintConfig = linter.hamlLintConfig;
  let fixedText = text;

  if (hamlLintConfig) {
    fixedText = fixWhitespace(fixedText, hamlLintConfig);
  }

  return fixedText;
}

function fixWhitespace(text: string, config: LinterConfig): string {
  let fixedText = text;

  // Remove trailing whitespace
  if (config.TrailingWhitespace.enabled) {
    fixedText = fixedText
      .split('\n')
      .map(line => line.replace(/\s+$/, ''))
      .join('\n');
  }

  // Remove trailing empty lines
  if (config.TrailingEmptyLines.enabled) {
    fixedText = fixedText.replace(/\n{2,}/g, '\n\n');
  }

  // Add a blank line at the end if not present
  if (config.FinalNewline.enabled) {
    fixedText = fixedText.endsWith('\n') ? fixedText : fixedText + '\n';
  }

  return fixedText;
}
