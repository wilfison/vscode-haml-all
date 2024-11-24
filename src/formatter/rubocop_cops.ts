import { RuboCopConfig } from '../types';

function fixStringLiterals(text: string, config: RuboCopConfig): string {
  if (!config['Style/StringLiterals'].enabled) {
    return text;
  }

  const enforcedStyle = config['Style/StringLiterals'].EnforcedStyle;
  const wrongQuote = enforcedStyle === 'double_quotes' ? '\'' : '"';
  const rightQuote = enforcedStyle === 'double_quotes' ? '"' : '\'';
  const regex = new RegExp(`${wrongQuote}{1}([^'",\\n]*)${wrongQuote}{1}`, 'g');

  return text.replaceAll(regex, `${rightQuote}$1${rightQuote}`);
}

export default {
  fixStringLiterals
};
