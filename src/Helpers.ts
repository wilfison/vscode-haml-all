import { exec } from "node:child_process";
import { workspace } from "vscode";

import { SOURCE } from "./Linter";

export function hamlLintPresent(): boolean {
  const config = workspace.getConfiguration("hamlAll");
  let executable = config.linterExecutablePath || SOURCE;

  try {
    exec(`${executable} --version`);
    return true;
  } catch (e) {
    return false;
  }
}
