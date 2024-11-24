import { LinterConfig } from '../types';

function fixTrailingWhitespace(text: string, config: LinterConfig): string {
  if (!config.TrailingWhitespace.enabled) {
    return text;
  }

  return text
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    .join('\n');
}

function fixTrailingEmptyLines(text: string, config: LinterConfig): string {
  if (!config.TrailingEmptyLines.enabled) {
    return text;
  }

  return text.replace(/\n{2,}/g, '\n\n');
}

function fixFinalNewline(text: string, config: LinterConfig): string {
  if (!config.FinalNewline.enabled) {
    return text;
  }

  return text.endsWith('\n') ? text.replace(/\n+$/, '\n') : `${text}\n`;
}

function fixClassBeforeId(text: string, config: LinterConfig): string {
  if (!config.ClassesBeforeIds.enabled) {
    return text;
  }

  const regex = /(?<id>#[\w\-_]+)(?<class>\.[\w\-_\.]+)/g;

  return text.replace(regex, '$2$1');
}

// Separate Ruby script indicators (-/=) from their code with a single space.
function fixSpaceBeforeScript(text: string, config: LinterConfig): string {
  if (!config.SpaceBeforeScript.enabled) {
    return text;
  }

  const lines = text.split('\n');
  const regex = /^\s*([-=](?!#))(?:\s{0}|\s{2,})(.*)/;

  return lines
    .map(line => {
      const match = line.match(regex);

      if (!match) {
        return line;
      }

      const indicator = match[1];
      const code = match[2];

      return line.replace(`${indicator}${code}`, `${indicator} ${code.trim()}`);
    })
    .join('\n');
}

function fixLeadingCommentSpace(text: string, config: LinterConfig): string {
  if (!config.LeadingCommentSpace.enabled) {
    return text;
  }

  const regex = /^\s*-#(?!\s)/;

  return text
    .split('\n')
    .map(line => (line.match(regex) ? line.replace(/-#/, '-# ') : line))
    .join('\n');
}

export default {
  fixTrailingWhitespace,
  fixTrailingEmptyLines,
  fixFinalNewline,
  fixClassBeforeId,
  fixSpaceBeforeScript,
  fixLeadingCommentSpace,
};
