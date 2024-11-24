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
}

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

/**
 * @see https://github.com/sds/haml-lint/blob/main/lib/haml_lint/linter/README.md
 */
export type LinterConfig = {
  ClassesBeforeIds: LinterConfigEnabler;
  FinalNewline: LinterConfigEnabler;
  // HtmlAttributes: LinterConfigEnabler;

  // Indentation: LinterConfigEnabler & {
  //   character: 'space' | 'tab';
  //   width: number;
  // };

  // LeadingCommentSpace: LinterConfigEnabler;
  SpaceBeforeScript: LinterConfigEnabler;
  // SpaceInsideHashAttributes: LinterConfigEnabler;
  TrailingEmptyLines: LinterConfigEnabler;
  TrailingWhitespace: LinterConfigEnabler;
}

export type RuboCopConfig = {
  'Style/StringLiterals': LinterConfigEnabler & {
    EnforcedStyle: 'double_quotes' | 'single_quotes';
  };
};
