// src/version.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function getPackageVersion(): string {
  const pkgPath = join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
  return pkg.version;
}
