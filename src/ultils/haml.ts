export const HAML_FILTERS = [
  'coffee',
  'coffeescript',
  'css',
  'erb',
  'escaped',
  'javascript',
  'less',
  'markdown',
  'plain',
  'preserve',
  'ruby',
  'sass',
  'scss',
  'cdata',
];

export function parseHtmlAttributes(inputString: string) {
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
    .map((key) => {
      let attrKey = key.includes('-') ? `"${key}"` : key;

      // do not add quotes to values that are a number
      if (!isNaN(Number(result[key]))) {
        return `${attrKey}: ${result[key]}`;
      }

      return `${attrKey}: "${result[key]}"`;
    })
    .join(', ');
}
