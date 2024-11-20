import { Html2HamlOptions } from './config';

function joinAttributeList(attr: string | undefined, joinChar: string): string {
  if (!attr) {
    return '';
  }

  return `${joinChar}${attr.split(' ').join(joinChar)}`;
}

function renderOtherAttributes(attributes: any): string {
  if (!attributes) { return ''; }

  let extraAttributes = Object.keys(attributes).filter((key) => !['class', 'id'].includes(key));

  if (extraAttributes.length === 0) { return ''; }

  extraAttributes = extraAttributes.map((key) => {
    let attributeKey = key.includes('-') ? `"${key}"` : key;

    return `${attributeKey}: "${attributes[key]}"`;
  });

  return `{ ${extraAttributes.join(', ')} }`;
}

function haveOtherTags(tagData: any): boolean {
  return Object.keys(tagData).some((key) => !['attributes', '#text'].includes(key));
}

function rubyLineNeedsInitialDash(content: string): boolean {
  return /^(?:if|else)/.test(content.trim());
}

export function formatTagLine(tag: string, tagData: any, tab: string, options: Html2HamlOptions) {
  const attributes = tagData.attributes;
  const tagText = tagData['#text'];

  let hamlTag = `%${tag}`;
  let tagContent = '';

  let tagAttributes = '';
  tagAttributes += joinAttributeList(attributes?.class, '.');
  tagAttributes += joinAttributeList(attributes?.id, '#');
  tagAttributes += renderOtherAttributes(attributes);

  if (tag === 'div' && ['.', '#'].includes(tagAttributes[0])) {
    hamlTag = '';
  }

  if (tagText && haveOtherTags(tagData)) {
    let breakTab = tab + options.tabChar.repeat(options.tabSize);
    tagContent = `\n${breakTab}${tagText}`;
  }
  else if (tagText) {
    tagContent = ` ${tagText}`;
  }

  switch (tag) {
    case 'ruby-block':
      hamlTag = attributes.content.startsWith('=') ? attributes.content : `- ${attributes.content}`;
      tagAttributes = '';
      tagContent = '';
      break;
    case 'ruby-line':
      hamlTag = rubyLineNeedsInitialDash(attributes.content) ? `- ${attributes.content}` : attributes.content;
      tagAttributes = '';
      tagContent = '';
      break;
  }

  return `${hamlTag}${tagAttributes}${tagContent}`;
}

export function buildHamlTag(
  tag: string,
  tagName: string,
  htmlJs: any,
  deep: number,
  options: Html2HamlOptions
): string {
  const { tabSize, tabChar } = options;
  const children = { ...htmlJs[tag] };

  const deepTabSize = tabSize * deep;
  const tab = tabChar.repeat(deepTabSize);

  let htmlTagLine = '';
  let hamlStr = '';

  delete children.attributes;
  delete children['#text'];

  if (!Array.isArray(htmlJs[tag])) {
    htmlTagLine = formatTagLine(tagName, htmlJs[tag], tab, options);
    hamlStr = `${tab}${htmlTagLine}\n`;
  }

  for (let subTag in children) {
    let isArrayOfChildren = Array.isArray(children[subTag]);

    let subTagName = isNaN(parseInt(subTag)) ? subTag : tagName;
    let deepLoop = isArrayOfChildren ? deep : deep + 1;

    let hamlTag = buildHamlTag(subTag, subTagName, children, deepLoop, options);

    if (hamlTag) {
      hamlStr += hamlTag;
    }
  }

  return hamlStr;
}

export function jsToHaml(htmlJs: any, options: Html2HamlOptions): string {
  if (typeof htmlJs !== 'object') {
    return '';
  }

  let deep = 0;
  let hamlStr = '';
  let children = { ...htmlJs };

  if (children['!doctype']) {
    hamlStr += '!!! 5\n';

    children = { ...children['!doctype'] };
  }

  for (const tag in children) {
    hamlStr += buildHamlTag(tag, tag, children, deep, options);
    deep = 0;
  }

  if (options.erb) {
    hamlStr = hamlStr.replace(/''/g, '"');
  }

  return hamlStr;
}
