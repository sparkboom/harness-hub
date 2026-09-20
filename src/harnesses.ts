export const ALL_HARNESS_IDS = [
  'claude-code',
  'cursor',
  'opencode',
  'codex',
  'hermes',
  'pi',
  'deepseek',
] as const;

export type HarnessId = (typeof ALL_HARNESS_IDS)[number];

export function isHarnessId(value: string): value is HarnessId {
  return (ALL_HARNESS_IDS as readonly string[]).includes(value);
}
