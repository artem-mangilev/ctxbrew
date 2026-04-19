import pc from "picocolors";

const noColor = process.env.NO_COLOR != null && process.env.NO_COLOR !== "";
const stderrTty = Boolean(process.stderr.isTTY);
const useColor = !noColor && stderrTty;

const paint = (fn: (s: string) => string, s: string) => (useColor ? fn(s) : s);

export const logger = {
  info: (msg: string) => {
    process.stderr.write(`${paint(pc.cyan, "info")} ${msg}\n`);
  },
  warn: (msg: string) => {
    process.stderr.write(`${paint(pc.yellow, "warn")} ${msg}\n`);
  },
  error: (msg: string, hint?: string) => {
    process.stderr.write(`${paint(pc.red, "error")} ${msg}\n`);
    if (hint) process.stderr.write(`${paint(pc.dim, "hint")}  ${hint}\n`);
  },
  success: (msg: string) => {
    process.stderr.write(`${paint(pc.green, "ok")}   ${msg}\n`);
  },
  debug: (msg: string) => {
    if (process.env.CTXBREW_DEBUG) {
      process.stderr.write(`${paint(pc.dim, "debug")} ${msg}\n`);
    }
  },
};

export const colorize = {
  bold: (s: string) => paint(pc.bold, s),
  dim: (s: string) => paint(pc.dim, s),
  cyan: (s: string) => paint(pc.cyan, s),
  green: (s: string) => paint(pc.green, s),
  yellow: (s: string) => paint(pc.yellow, s),
  red: (s: string) => paint(pc.red, s),
};
