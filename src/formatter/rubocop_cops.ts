import { RuboCopConfig } from '../types';
import { RESERVED_RUBY_WORDS } from '../ultils/ruby';

function fixStringLiterals(text: string, config: RuboCopConfig): string {
  if (!config['Style/StringLiterals'].Enabled) {
    return text;
  }

  const enforcedStyle = config['Style/StringLiterals'].EnforcedStyle;
  const wrongQuote = enforcedStyle === 'double_quotes' ? '\'' : '"';
  const rightQuote = enforcedStyle === 'double_quotes' ? '"' : '\'';
  const regex = new RegExp(`(?<!#{\\w+\\()${wrongQuote}([^'",\\n#]*)${wrongQuote}`, 'g');

  return text.replace(regex, (textMatch) => {
    if (textMatch.includes('#{')) {
      return textMatch;
    }

    return textMatch.replaceAll(wrongQuote, rightQuote);
  });
}

function fixSpaceInsideParens(text: string, config: RuboCopConfig): string {
  if (!config['Layout/SpaceInsideParens'].Enabled) {
    return text;
  }

  const enforcedStyle = config['Layout/SpaceInsideParens'].EnforcedStyle;

  if (enforcedStyle === 'compact') {
    return text;
  }

  const space = enforcedStyle === 'space' ? ' ' : '';
  const regex = /\((.*)\)$/;

  const match = text.match(regex);

  if (!match) {
    return text;
  }

  const code = match[1].trim();

  return text.replace(match[0], `(${space}${code}${space})`);
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

function fixSpaceAfterColon(text: string, config: RuboCopConfig): string {
  if (!config['Layout/SpaceAfterColon'].Enabled) {
    return text;
  }

  const regex = /(?<=^\s*[=\-\.%][^#].*)(?:[,\(\{]+\s*)[\w\-'"]+:(?![\s:])(.)/g;
  const match = text.match(regex);

  if (!match) {
    return text;
  }

  match.forEach(m => {
    text = text.replace(m, m.replace(':', ': '));
  });

  return text;
}

// Only add parentheses around method calls with arguments when there are no parentheses
function fixMethodCallWithArgsParentheses(text: string, config: RuboCopConfig): string {
  const copConfig = config['Style/MethodCallWithArgsParentheses'];

  if (!copConfig.Enabled || copConfig.EnforcedStyle !== 'require_parentheses') {
    return text;
  }

  const regexLineWithScript = new RegExp(`^\\s*(?:[\\.%][\\w-]+)?[=-] +(?!${RESERVED_RUBY_WORDS.join('|')})[\\w\\.]+`);

  const match = text.match(regexLineWithScript);

  if (!match || text.includes('||') || text.slice(-1) === ',') {
    return text;
  }

  let scriptAttributes = text.split(match[0])[1];

  if (!scriptAttributes.startsWith(' ')) {
    return text;
  }

  if (scriptAttributes.includes(' do')) {
    const matchBlock = scriptAttributes.match(/(.*) do \|[\w, ]+\|$|(.*) do$/);
    scriptAttributes = matchBlock ? (matchBlock[1] || matchBlock[2]) : scriptAttributes;
  }

  if (String(scriptAttributes).trim().length === 0) {
    return text;
  }

  const attributesFormated = `(${scriptAttributes.trim()})`;

  return text.replace(scriptAttributes, attributesFormated);
}

export type RuboCopFixer = (text: string, config: RuboCopConfig) => string;

export const rubocops: [keyof RuboCopConfig, RuboCopFixer][] = [
  ['Style/StringLiterals', fixStringLiterals],
  ['Layout/SpaceInsideParens', fixSpaceInsideParens],
  ['Layout/SpaceBeforeComma', fixSpaceBeforeComma],
  ['Layout/SpaceAfterColon', fixSpaceAfterColon],
  ['Style/MethodCallWithArgsParentheses', fixMethodCallWithArgsParentheses]
];

export default {
  fixStringLiterals,
  fixSpaceAfterColon,
  fixSpaceBeforeComma,
  fixSpaceInsideParens,
  fixMethodCallWithArgsParentheses
};
