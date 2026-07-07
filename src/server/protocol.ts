/**
 * Shared vocabulary for talking to the Ruby lint server. Pure type/constant
 * declarations — no runtime dependency on node or vscode.
 */

/** Uniform response envelope returned by the Ruby lint server. */
export type ServerResponse<T> = {
  status: string;
  result: T;
};

/** Callback used by the fire-and-forget action methods (lint, listCops). */
export type CallbackFunc<T> = (data: T) => void;

/** Sink for human-readable diagnostics (wired to the "Haml" output channel). */
export type Logger = (message: string) => void;

/** Wire names for the actions the Ruby server dispatches (lib/lint_server/dispatcher.rb). */
export const ACTIONS = {
  lint: 'lint',
  autocorrect: 'autocorrect',
  listCops: 'list_cops',
} as const;

/** Time budgets (ms) for server interactions. */
export const TIMEOUTS = {
  /** Autocorrect must be fast enough to run on format; bail out otherwise. */
  autocorrectMs: 1000,
  /** How long to wait for the Ruby server's start-up line before giving up. */
  startupMs: 10000,
  /** Ceiling for lint/list_cops requests so a stuck server can never hang the client. */
  requestMs: 30000,
} as const;
