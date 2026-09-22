import { canonPresenceRule } from './canonPresence';
import { configValidityRule } from './configValidity';
import { skillShapeRule } from './skillShape';
import { skillFrontmatterRule } from './skillFrontmatter';
import { clobberRiskRule } from './clobberRisk';
import { skillMigrationRule } from './skillMigration';
import { trustGateRule } from './trustGate';
import { generatedFileDriftRule } from './generatedFileDrift';
import { versionStatusRule } from './versionStatus';
import type { DoctorRule } from '../types';

export const ALL_DOCTOR_RULES: DoctorRule[] = [
  canonPresenceRule,
  configValidityRule,
  skillShapeRule,
  skillFrontmatterRule,
  clobberRiskRule,
  skillMigrationRule,
  trustGateRule,
  generatedFileDriftRule,
  versionStatusRule,
];
