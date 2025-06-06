export function ecmaScriptRegexFromRubyRegex(regex: string): RegExp {
  const replacers = [
    ['\\\\A', '^'],
    ['\\\\z', '$'],
    ['\\\\Z', '$'],
  ];

  const ecmaReg = replacers.reduce((acc, [from, to]) => acc.replace(new RegExp(from, 'g'), to), regex);

  return new RegExp(ecmaReg);
}

export function stringReplace(text: string, regex: RegExp | string, replacement: string): string {
  const satitizedReplacement = replacement.replace('$', '$$$');

  return text.replace(regex, satitizedReplacement);
}
