import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { ALL_HARNESS_IDS, isHarnessId, type HarnessId } from './harnesses';

export const YAML_CONFIG_FILENAME = 'harness-hub.yaml';
export const JSON_CONFIG_FILENAME = 'harness-hub.json';

export type ConfigFormat = 'yaml' | 'json';

export type ConfigLoadResult =
  | { status: 'absent' }
  | { status: 'ambiguous'; yamlPath: string; jsonPath: string }
  | { status: 'parse-error'; format: ConfigFormat; path: string; error: string }
  | { status: 'invalid-shape'; format: ConfigFormat; path: string; reason: string }
  | { status: 'ok'; format: ConfigFormat; path: string; harnesses: HarnessId[]; unknownIds: string[] };

export function loadConfig(repoRoot: string): ConfigLoadResult {
  const yamlPath = join(repoRoot, YAML_CONFIG_FILENAME);
  const jsonPath = join(repoRoot, JSON_CONFIG_FILENAME);
  const yamlExists = existsSync(yamlPath);
  const jsonExists = existsSync(jsonPath);

  if (yamlExists && jsonExists) {
    return { status: 'ambiguous', yamlPath, jsonPath };
  }
  if (!yamlExists && !jsonExists) {
    return { status: 'absent' };
  }

  const format: ConfigFormat = yamlExists ? 'yaml' : 'json';
  const path = yamlExists ? yamlPath : jsonPath;
  const raw = readFileSync(path, 'utf8');

  let parsed: unknown;
  try {
    parsed = format === 'yaml' ? parseYaml(raw) : JSON.parse(raw);
  } catch (err) {
    return { status: 'parse-error', format, path, error: err instanceof Error ? err.message : String(err) };
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('harnesses' in parsed) ||
    !Array.isArray((parsed as { harnesses: unknown }).harnesses)
  ) {
    return { status: 'invalid-shape', format, path, reason: '"harnesses" must be an array' };
  }

  const rawHarnesses = (parsed as { harnesses: unknown[] }).harnesses;
  const harnesses: HarnessId[] = [];
  const unknownIds: string[] = [];
  for (const entry of rawHarnesses) {
    if (typeof entry === 'string' && isHarnessId(entry)) {
      harnesses.push(entry);
    } else {
      unknownIds.push(String(entry));
    }
  }

  return { status: 'ok', format, path, harnesses, unknownIds };
}

export function saveConfig(repoRoot: string, harnesses: HarnessId[]): void {
  const yamlPath = join(repoRoot, YAML_CONFIG_FILENAME);
  const jsonPath = join(repoRoot, JSON_CONFIG_FILENAME);
  const format: ConfigFormat = existsSync(jsonPath) && !existsSync(yamlPath) ? 'json' : 'yaml';
  const sorted = [...harnesses].sort((a, b) => ALL_HARNESS_IDS.indexOf(a) - ALL_HARNESS_IDS.indexOf(b));

  if (format === 'json') {
    writeFileSync(jsonPath, JSON.stringify({ harnesses: sorted }, null, 2) + '\n', 'utf8');
  } else {
    writeFileSync(yamlPath, stringifyYaml({ harnesses: sorted }), 'utf8');
  }
}
