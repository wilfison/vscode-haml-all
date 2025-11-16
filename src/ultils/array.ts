/**
 * Check if a string contains any of the substrings in an array
 */
export function stringContainsAny(str: String, array_strings: Array<string>): boolean {
  return array_strings.some((substring) => str.includes(substring));
}
