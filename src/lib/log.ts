export type LogLevel = "info" | "warn" | "error";
export type LogFields = Record<string, number | boolean | null>;

export function log(level: LogLevel, msg: string, fields: LogFields = {}): void {
  console[level](JSON.stringify({ level, msg, fields, ts: new Date().toISOString() }));
}
