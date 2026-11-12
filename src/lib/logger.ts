import * as pulumi from "@pulumi/pulumi";
import chalk from "chalk";

type LogLevel = "info" | "warn" | "error";

const levelColors = { info: chalk.cyan, warn: chalk.yellow, error: chalk.red };

function write(level: LogLevel, scope: string, message: string): void {
  const phase = pulumi.runtime.isDryRun() ? "preview" : "update";
  const label = levelColors[level].bold(`[${level.toUpperCase()}] [${scope}]`);
  pulumi.log[level](`${chalk.magenta(`[${phase}]`)} ${label} ${message}`);
}

export const logger = {
  info: (scope: string, message: string): void => write("info", scope, message),
  warn: (scope: string, message: string): void => write("warn", scope, message),
  error: (scope: string, message: string): void => write("error", scope, message),
};
