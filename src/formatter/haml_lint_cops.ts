import { LinterConfig } from '../types';
import { parseHtmlAttributes } from '../ultils/haml';

function fixTrailingWhitespace(text: string, config: LinterConfig): string {
  if (!config.TrailingWhitespace.enabled) {
    return text;
  }

  return text.trimEnd();
}

function fixTrailingEmptyLines(text: string, config: LinterConfig): string {
  if (!config.TrailingEmptyLines.enabled) {
    return text;
  }

  return text.replace(/\n{2,}$/gm, '\n\n');
}

function fixFinalNewline(text: string, config: LinterConfig | null): string {
  if (!config?.FinalNewline.enabled) {
    return text;
  }

  return text.trimEnd() + '\n';
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

  const regex = /^\s*([-=](?!#))(?:\s{0}|\s{2,})(.*)/;
  const match = text.match(regex);

  if (!match) {
    return text;
  }

  const indicator = match[1];
  const code = match[2];

  return text.replace(`${indicator}${code}`, `${indicator} ${code.trim()}`);
}

function fixLeadingCommentSpace(text: string, config: LinterConfig): string {
  if (!config.LeadingCommentSpace.enabled) {
    return text;
  }

  const regex = /^\s*-#(?!\s)[\w\d]+/;

  return text.match(regex) ? text.replace(/-#/, '-# ') : text;
}

function fixHtmlAttributes(text: string, config: LinterConfig): string {
  if (!config.HtmlAttributes.enabled) {
    return text;
  }

  const regex = /^\s*(?:[\.#%][\w-]+)+\(.*\)/;
  const match = text.match(regex);

  if (!match) {
    return text;
  }

  const attributesRegex = /\((?<attributes>.*)\)$/;
  const attributes = match[0].match(attributesRegex)?.groups?.attributes;

  if (!attributes) {
    return text;
  }

  return text.replace(`(${attributes})`, `{${parseHtmlAttributes(attributes)}}`);
}

function fixUnnecessaryStringOutput(text: string, config: LinterConfig): string {
  if (!config.UnnecessaryStringOutput.enabled) {
    return text;
  }

  const regex = /=\s*["']([\w\s\d#\{\}]*)["']$/g;

  return text.replace(regex, '$1');
}

export type HamlLintFixer = (text: string, config: LinterConfig) => string;

export const linter_cops: [keyof LinterConfig, HamlLintFixer][] = [
  ['TrailingWhitespace', fixTrailingWhitespace],
  ['TrailingEmptyLines', fixTrailingEmptyLines],
  ['ClassesBeforeIds', fixClassBeforeId],
  ['SpaceBeforeScript', fixSpaceBeforeScript],
  ['LeadingCommentSpace', fixLeadingCommentSpace],
  ['HtmlAttributes', fixHtmlAttributes],
  ['UnnecessaryStringOutput', fixUnnecessaryStringOutput],
];

export default {
  fixTrailingWhitespace,
  fixTrailingEmptyLines,
  fixHtmlAttributes,
  fixClassBeforeId,
  fixSpaceBeforeScript,
  fixLeadingCommentSpace,
  fixUnnecessaryStringOutput,
  fixFinalNewline,
};
