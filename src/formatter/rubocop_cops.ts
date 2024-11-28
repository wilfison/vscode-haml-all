import { RuboCopConfig } from '../types';

function fixStringLiterals(text: string, config: RuboCopConfig): string {
  if (!config['Style/StringLiterals'].Enabled) {
    return text;
  }

  const enforcedStyle = config['Style/StringLiterals'].EnforcedStyle;
  const wrongQuote = enforcedStyle === 'double_quotes' ? '\'' : '"';
  const rightQuote = enforcedStyle === 'double_quotes' ? '"' : '\'';
  const regex = new RegExp(`${wrongQuote}([^'",\\n]*)${wrongQuote}`, 'g');

  return text.split('\n').map(line => {
    return line.replace(regex, match => {
      if (match.includes('#{')) {
        return match;
      }
      return match.replace(new RegExp(wrongQuote, 'g'), rightQuote);
    });
  }).join('\n');
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

function fixSpaceBeforeComma(text: string, config: RuboCopConfig): string {
  if (!config['Layout/SpaceBeforeComma'].Enabled) {
    return text;
  }

  const regex = /(?<!^\s*)(?<!["'].*)\s,(\s?)|(?<!^\s*)\s,(\s?(?:["']?[\w-]+["']?\s?[:=>]+))/g;
  const match = text.match(regex);

  if (!match) {
    return text;
  }

  return text.replace(regex, ',$1$2');
}

export default {
  fixStringLiterals,
  fixSpaceInsideParens,
  fixSpaceBeforeComma
};
