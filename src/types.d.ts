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
