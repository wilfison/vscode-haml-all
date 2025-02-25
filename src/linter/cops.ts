import { LinterConfig } from '../types';

export const HAML_LINT_DEFAULT_COPS: LinterConfig = {
  RuboCop: { enabled: false, ignored_cops: [] },
  ClassesBeforeIds: { enabled: false },
  FinalNewline: { enabled: false },
  HtmlAttributes: { enabled: false },
  LeadingCommentSpace: { enabled: false },
  SpaceBeforeScript: { enabled: false },
  TrailingEmptyLines: { enabled: false },
  TrailingWhitespace: { enabled: false },
  UnnecessaryStringOutput: { enabled: false },
};
