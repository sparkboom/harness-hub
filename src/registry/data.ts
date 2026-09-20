import type { HarnessId } from '../harnesses';
import type { HarnessEntry } from './types';

export const HARNESS_REGISTRY: Record<HarnessId, HarnessEntry> = {
  'claude-code': {
    id: 'claude-code',
    displayName: 'Claude Code',
    verifiedVersion: 'unpinned', // opaque native binary — not version-pinned in harness-versions.insight.md
    verifiedDate: '2026-09-20',
    agentsDoc: { mode: 'symlink', symlinkPath: 'CLAUDE.md' },
    skills: { mode: 'migrate-symlink', symlinkPath: '.claude/skills' },
  },
  cursor: {
    id: 'cursor',
    displayName: 'Cursor',
    verifiedVersion: '3.x',
    verifiedDate: '2026-09-10',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
  opencode: {
    id: 'opencode',
    displayName: 'OpenCode',
    verifiedVersion: '1.18.31',
    verifiedDate: '2026-09-14',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
  codex: {
    id: 'codex',
    displayName: 'Codex',
    verifiedVersion: '0.153.2',
    verifiedDate: '2026-09-03',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
  hermes: {
    id: 'hermes',
    displayName: 'Hermes',
    verifiedVersion: '0.21.2',
    verifiedDate: '2026-09-11',
    agentsDoc: { mode: 'native' },
    skills: {
      mode: 'native',
      trustGate: {
        configPathFromHome: '.hermes/config.yaml',
        trustedDirsKeyPath: ['skills', 'trusted_project_dirs'],
        trustCommand: 'hermes skills trust',
      },
    },
  },
  pi: {
    id: 'pi',
    displayName: 'Pi',
    verifiedVersion: '0.85.0',
    verifiedDate: '2026-09-04',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
  deepseek: {
    id: 'deepseek',
    displayName: 'DeepSeek Harness',
    verifiedVersion: '0.1.5-rc.1',
    verifiedDate: '2026-09-10',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
};
