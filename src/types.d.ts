import { CompletionItem } from 'vscode';

type ExtensionConfig = {
  lintEnabled: boolean;
  linterExecutablePath: string;
  useBundler: boolean;
};

type LinterOffense = {
  linter_name: string;
  location: {
    line: number;
  };
  message: string;
  severity: string;
  /** Whether haml-lint can autocorrect it. null/absent with haml_lint < 0.76. */
  correctable?: boolean | null;
};

type LinterOutputFile = {
  path: string;
  offenses: LinterOffense[];
};

export type LinterOutput = {
  files: LinterOutputFile[];
};

export type CompletionItemWithScore = {
  item: CompletionItem | null;
  score: number;
};

type LinterConfigEnabler = {
  enabled: boolean;
};

type LinterRubocopIgnores = {
  ignored_cops: string[];
} & LinterConfigEnabler;

type LinterMetcher = {
  file_types: 'partials' | 'all';
  matchers: {
    all: string;
    partials: string;
  };
} & LinterConfigEnabler;

/**
 * @see https://github.com/sds/haml-lint/blob/main/lib/haml_lint/linter/README.md
 */
export type LinterConfig = {
  RuboCop: LinterRubocopIgnores;
  ClassesBeforeIds: LinterConfigEnabler;
  FinalNewline: LinterConfigEnabler;
  HtmlAttributes: LinterConfigEnabler;
  LeadingCommentSpace: LinterConfigEnabler;
  SpaceBeforeScript: LinterConfigEnabler;
  StrictLocals: LinterMetcher;
  TrailingEmptyLines: LinterConfigEnabler;
  TrailingWhitespace: LinterConfigEnabler;
  UnnecessaryStringOutput: LinterConfigEnabler;
};
