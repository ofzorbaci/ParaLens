/** A short random id for holdings and portfolios: time-based prefix, random suffix. */
export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
