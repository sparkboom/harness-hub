import type { Asset } from '../primitives';

export interface Scenario {
  name: string;
  description: string;
  assets(target: string): Asset[];
  actions?(target: string): void;
}

import { baseline } from './baseline';
import { claudeEnable } from './claude-enable';
import { claudeMdClobber } from './claude-md-clobber';
import { claudeSkillsClobber } from './claude-skills-clobber';
import { claudeDrift } from './claude-drift';
import { missingAgentsMd } from './missing-agents-md';
import { ambiguousConfig } from './ambiguous-config';
import { configInvalidShape } from './config-invalid-shape';
import { configParseError } from './config-parse-error';
import { unknownHarnessId } from './unknown-harness-id';
import { flatSkillFile } from './flat-skill-file';
import { skillMissingSkillMd } from './skill-missing-skill-md';
import { skillMissingName } from './skill-missing-name';
import { skillNameMismatch } from './skill-name-mismatch';
import { skillMissingDescription } from './skill-missing-description';
import { unmigratedSkills } from './unmigrated-skills';
import { skillMigrationCollision } from './skill-migration-collision';
import { hermesTrust } from './hermes-trust';
import { multi } from './multi';

export const SCENARIOS: Record<string, Scenario> = {
  baseline, 'claude-enable': claudeEnable, 'claude-md-clobber': claudeMdClobber,
  'claude-skills-clobber': claudeSkillsClobber, 'claude-drift': claudeDrift,
  'missing-agents-md': missingAgentsMd, 'ambiguous-config': ambiguousConfig,
  'config-invalid-shape': configInvalidShape, 'config-parse-error': configParseError,
  'unknown-harness-id': unknownHarnessId, 'flat-skill-file': flatSkillFile,
  'skill-missing-skill-md': skillMissingSkillMd, 'skill-missing-name': skillMissingName,
  'skill-name-mismatch': skillNameMismatch, 'skill-missing-description': skillMissingDescription,
  'unmigrated-skills': unmigratedSkills, 'skill-migration-collision': skillMigrationCollision,
  'hermes-trust': hermesTrust, multi,
};
