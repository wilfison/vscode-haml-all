
export const HAML_COPS_URL = 'https://github.com/sds/haml-lint/blob/main/lib/haml_lint/linter/README.md';

export function hamlCopUrl(code: string) {
  return `${HAML_COPS_URL}#${code.toLowerCase()}`;
}
