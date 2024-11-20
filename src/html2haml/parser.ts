import { X2jOptions, XMLParser } from 'fast-xml-parser';

import { parseErb } from './erb';

const X2J_OPTIONS: X2jOptions = {
  allowBooleanAttributes: false,
  ignoreAttributes: false,
  attributesGroupName: 'attributes',
  attributeNamePrefix: '',
  alwaysCreateTextNode: true,
  unpairedTags: [
    'br',
    'hr',
    'input',
    'img',
    'area',
    'param',
    'col',
    'base',
    'link',
    'meta',
    'ruby-line',
  ],
};

type HtmlToJsOptions = {
  erb?: boolean;
};

export function htmlToJs(htmlStr: string, options: HtmlToJsOptions = {}): string {
  const parser = new XMLParser(X2J_OPTIONS);

  let htmlStrContent = htmlStr;

  if (options.erb) {
    htmlStrContent = parseErb(htmlStr);
  }

  return parser.parse(htmlStrContent);
}
