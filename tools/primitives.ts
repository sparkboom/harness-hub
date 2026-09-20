import { stringify } from 'yaml';
import { join } from 'node:path';

export interface Asset {
  path: string;
  content: string;
}

export function agentDoc(path: string, content: string): Asset {
  return { path, content };
}

export function skill(opts: {
  name: string;
  location: string;
  frontmatter: Record<string, unknown>;
  body?: string;
}): Asset {
  const fm = Object.keys(opts.frontmatter).length > 0
    ? `---\n${stringify(opts.frontmatter)}---\n`
    : '';
  const body = opts.body ?? `Placeholder body for skill "${opts.name}".\n`;
  return { path: join(opts.location, opts.name, 'SKILL.md'), content: fm + body };
}

export function raw(path: string, content: string): Asset {
  return { path, content };
}

export { writeAssets, resetTarget } from './fs';
