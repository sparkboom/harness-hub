import { ALL_HARNESS_IDS } from '../harnesses';
import { getHarnessEntry } from '../registry';

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

export function formatList(): string {
  const rows = [...ALL_HARNESS_IDS].sort().map((id) => {
    const e = getHarnessEntry(id);
    const skills = e.skills.mode === 'migrate-symlink' ? 'migrate-symlink' : e.skills.mode;
    const trustGate = e.skills.trustGate ? e.skills.trustGate.trustCommand : '-';
    return [
      pad(e.id, 12),
      pad(e.displayName, 18),
      pad(e.verifiedVersion, 12),
      pad(e.agentsDoc.mode, 12),
      pad(skills, 12),
      trustGate,
    ].join(' ');
  });
  return [
    `${pad('ID', 12)}${pad('NAME', 18)}${pad('VERSION', 12)}${pad('AGENT DOC', 12)}${pad('SKILLS', 12)}TRUST GATE`,
    ...rows,
  ].join('\n');
}
