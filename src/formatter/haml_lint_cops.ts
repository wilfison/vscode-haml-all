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

  const regex = /^\s*-#(?!\s)\w+/;

  return text
    .split('\n')
    .map(line => (line.match(regex) ? line.replace(/-#/, '-# ') : line))
    .join('\n');
}

function fixHtmlAttributes(text: string, config: LinterConfig): string {
  if (!config.HtmlAttributes.enabled) {
    return text;
  }

  const regex = /^\s*(?:[\.#%][\w-]+)+\(.*\)/;
  const attributesRegex = /\((?<attributes>.*)\)$/;
  const lines = text.split('\n');

  function parseAttributes(inputString: string) {
    const result: { [key: string]: string } = {};
    // Regex to capture key=value parts (allowing quotes and unquoted values)
    const regex = /(\w[\w-]*)=(?:"([^"]*)"|'([^']*)'|([^"\s]*))/g;
    let match;

    while ((match = regex.exec(inputString)) !== null) {
      // Capture the key and value, prioritizing double-quoted, single-quoted, or unquoted values
      const key = match[1];
      let value = match[2] || match[3] || match[4];

      result[key] = value;
    }

    return Object.keys(result)
      .map(key => {
        let attrKey = key.includes('-') ? `"${key}"` : key;

        // do not add quotes to values that are a number
        if (!isNaN(Number(result[key]))) {
          return `${attrKey}: ${result[key]}`;
        }

        return `${attrKey}: "${result[key]}"`;
      })
      .join(', ');
  }

  return lines
    .map(line => {
      const match = line.match(regex);

      if (!match) {
        return line;
      }

      const attributes = match[0].match(attributesRegex)?.groups?.attributes;
      if (!attributes) {
        return line;
      }

      return line.replace(`(${attributes})`, `{${parseAttributes(attributes)}}`);
    })
    .join('\n');
}

export default {
  fixTrailingWhitespace,
  fixTrailingEmptyLines,
  fixFinalNewline,
  fixHtmlAttributes,
  fixClassBeforeId,
  fixSpaceBeforeScript,
  fixLeadingCommentSpace,
};
