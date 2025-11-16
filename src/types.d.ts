import { CompletionItem } from 'vscode';

type ExtensionConfig = {
  lintEnabled: boolean;
  linterExecutablePath: string;
  simpleAutoFixOnSave: boolean;
  useBundler: boolean;
};

type LinterOffense = {
  linter_name: string;
  location: {
    line: number;
  };
  message: string;
  severity: string;
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

export type LinterConfigWithErrors = {
  haml_lint: { error?: string };
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
