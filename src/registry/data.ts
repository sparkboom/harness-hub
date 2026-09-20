import type { HarnessId } from '../harnesses';
import type { HarnessEntry } from './types';
import { loadVersionsManifest } from './versions';

const versions = loadVersionsManifest();

export const HARNESS_REGISTRY: Record<HarnessId, HarnessEntry> = {
  'claude-code': {
    id: 'claude-code',
    displayName: versions['claude-code'].displayName,
    verifiedVersion: versions['claude-code'].version,
    verifiedDate: versions['claude-code'].verifiedDate,
    agentsDoc: { mode: 'symlink', symlinkPath: 'CLAUDE.md' },
    skills: { mode: 'migrate-symlink', symlinkPath: '.claude/skills' },
  },
  cursor: {
    id: 'cursor',
    displayName: versions.cursor.displayName,
    verifiedVersion: versions.cursor.version,
    verifiedDate: versions.cursor.verifiedDate,
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
  opencode: {
    id: 'opencode',
    displayName: versions.opencode.displayName,
    verifiedVersion: versions.opencode.version,
    verifiedDate: versions.opencode.verifiedDate,
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
  codex: {
    id: 'codex',
    displayName: versions.codex.displayName,
    verifiedVersion: versions.codex.version,
    verifiedDate: versions.codex.verifiedDate,
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
  hermes: {
    id: 'hermes',
    displayName: versions.hermes.displayName,
    verifiedVersion: versions.hermes.version,
    verifiedDate: versions.hermes.verifiedDate,
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
    displayName: versions.pi.displayName,
    verifiedVersion: versions.pi.version,
    verifiedDate: versions.pi.verifiedDate,
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
  deepseek: {
    id: 'deepseek',
    displayName: versions.deepseek.displayName,
    verifiedVersion: versions.deepseek.version,
    verifiedDate: versions.deepseek.verifiedDate,
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
};
