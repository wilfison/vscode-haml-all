import { RuboCopConfig } from '../types';

const RESERVED_WORDS = [
  'if',
  'unless',
  'while',
  'until',
  'rescue',
  'else',
  'elsif',
  'when',
  'ensure',
  'case',
  'for',
  'return',
  'break',
  'next',
  'raise',
  'fail',
  'alias',
  'undef',
  'self',
  'nil'
];

function fixStringLiterals(text: string, config: RuboCopConfig): string {
  if (!config['Style/StringLiterals'].Enabled) {
    return text;
  }

  const enforcedStyle = config['Style/StringLiterals'].EnforcedStyle;
  const wrongQuote = enforcedStyle === 'double_quotes' ? '\'' : '"';
  const rightQuote = enforcedStyle === 'double_quotes' ? '"' : '\'';
  const regex = new RegExp(`(?<!#{\\w+\\()${wrongQuote}([^'",\\n#]*)${wrongQuote}`, 'g');

  return text.split('\n').map(line => {
    return line.replace(regex, match => {
      if (match.includes('#{')) {
        return match;
      }

      return match.replaceAll(wrongQuote, rightQuote);
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

function fixSpaceAfterColon(text: string, config: RuboCopConfig): string {
  if (!config['Layout/SpaceAfterColon'].Enabled) {
    return text;
  }

  const regex = /(?<=^\s*[=\-\.%][^#].*)(?:[,\(\{]+\s*)[\w-]+:(?![\s:])(.)/g;

  const fixedText = text.split('\n').map(line => {
    const match = line.match(regex);

    if (!match) {
      return line;
    }

    console.log(match);

    match.forEach(m => {
      line = line.replace(m, m.replace(':', ': '));
    });

    return line;
  });

  return fixedText.join('\n');
}

// Only add parentheses around method calls with arguments when there are no parentheses
function fixMethodCallWithArgsParentheses(text: string, config: RuboCopConfig): string {
  const copConfig = config['Style/MethodCallWithArgsParentheses'];

  if (!copConfig.Enabled || copConfig.EnforcedStyle !== 'require_parentheses') {
    return text;
  }

  const regexLineWithScript = new RegExp(`^\\s*(?:[\\.%][\\w-]+)?[=-] +(?!${RESERVED_WORDS.join('|')})[\\w\\.]+`);

  const lines = text.split('\n');
  const fixedText = lines.map((line, index) => {
    const match = line.match(regexLineWithScript);

    if (!match || line.includes('||') || line.slice(-1) === ',') {
      return line;
    }

    let scriptAttributes = line.split(match[0])[1];

    if (!scriptAttributes.startsWith(' ')) {
      return line;
    }

    if (scriptAttributes.includes(' do')) {
      const matchBlock = scriptAttributes.match(/(.*) do \|[\w, ]+\|$|(.*) do$/);
      scriptAttributes = matchBlock ? (matchBlock[1] || matchBlock[2]) : scriptAttributes;
    }

    if (String(scriptAttributes).trim().length === 0) {
      return line;
    }

    const attributesFormated = `(${scriptAttributes.trim()})`;

    return line.replace(scriptAttributes, attributesFormated);
  });

  return fixedText.join('\n');
}

export const rubocops: [string, (text: string, config: RuboCopConfig) => string][] = [
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
