const ERB_TAG_REGEX = /<%([^<]*)%>/gm;
const ERB_SCAPE_QUOTES_CHAR = '\'\'';
const ERB_OPEN_BLOCK = /^-?(?:if)|\sdo\s\|/;

export function setErbTag(htmlLine: string, match: string) {
  let content = match.replaceAll(/\n\s*/g, ' ').replace('<%', '');
  content = content.replace('-%>', '');
  content = content.replace('%>', '');
  content = content.trim();

  // fix quotes to fast-xml-parser
  content = content.replace(/"/g, ERB_SCAPE_QUOTES_CHAR);

  if (ERB_OPEN_BLOCK.test(content)) {
    content = `<ruby-block content="${content}">`;
  } else if (content === 'end') {
    content = '</ruby-block>';
  } else if (content === 'else') {
    content = `</ruby-block>\n<ruby-block content="${content}">`;
  } else {
    content = `<ruby-line content="${content}">`;
  }

  return htmlLine.replace(match, content);
}

export function parseErb(htmlStr: string): string {
  let newHtml = htmlStr;
  const matches = newHtml.match(ERB_TAG_REGEX);

  if (matches) {
    matches.forEach((match) => {
      newHtml = setErbTag(newHtml, match);
    });
  }

  console.log(newHtml);

  return newHtml;
}
