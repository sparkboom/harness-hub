import type { AgentsDocConvention, SkillsConvention, TrustGateConvention } from './types';

export interface ConventionProfile {
  name: string;
  agentsDoc: AgentsDocConvention;
  skills: SkillsConvention;
}

const hermesTrustGate: TrustGateConvention = {
  configPathFromHome: '.hermes/config.yaml',
  trustedDirsKeyPath: ['skills', 'trusted_project_dirs'],
  trustCommand: 'hermes skills trust',
};

export const CONVENTION_PROFILES: Record<string, ConventionProfile> = {
  'claude-code-symlink-v1': {
    name: 'claude-code-symlink-v1',
    agentsDoc: { mode: 'symlink', symlinkPath: 'CLAUDE.md' },
    skills: { mode: 'migrate-symlink', symlinkPath: '.claude/skills' },
  },
  'hermes-native-v1': {
    name: 'hermes-native-v1',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native', trustGate: hermesTrustGate },
  },
  'native-v1': {
    name: 'native-v1',
    agentsDoc: { mode: 'native' },
    skills: { mode: 'native' },
  },
};

export function getProfile(name: string): ConventionProfile | undefined {
  return CONVENTION_PROFILES[name];
}
