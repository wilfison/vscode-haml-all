import { RuboCopConfig } from '../types';

function fixStringLiterals(text: string, config: RuboCopConfig): string {
  if (!config['Style/StringLiterals'].Enabled) {
    return text;
  }

  const enforcedStyle = config['Style/StringLiterals'].EnforcedStyle;
  const wrongQuote = enforcedStyle === 'double_quotes' ? '\'' : '"';
  const rightQuote = enforcedStyle === 'double_quotes' ? '"' : '\'';
  const regex = new RegExp(`${wrongQuote}{1}([^'",\\n]*)${wrongQuote}{1}`, 'g');

  return text.replaceAll(regex, `${rightQuote}$1${rightQuote}`);
}

function fixSpaceInsideParens(text: string, config: RuboCopConfig): string {
  if (!config['Layout/SpaceInsideParens'].Enabled) {
    return text;
  }

  const enforcedStyle = config['Layout/SpaceInsideParens'].EnforcedStyle;

  if (enforcedStyle === 'compact') {
    return text;
  }

  const lines = text.split('\n');
  const space = enforcedStyle === 'space' ? ' ' : '';
  const regex = /\((.*)\)$/;

  return lines
    .map(line => {
      const match = line.match(regex);

      if (!match) {
        return line;
      }

      const code = match[1].trim();
      return line.replace(match[0], `(${space}${code}${space})`);
    })
    .join('\n');
}

export default {
  fixStringLiterals,
  fixSpaceInsideParens
};
