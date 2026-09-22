import { agentDoc, skill, raw, type Asset } from '../primitives';

export function validAgentsDoc(): Asset {
  return agentDoc('AGENTS.md', '# Agents\n\nMinimal consumer-repo agent doc for harness-hub testing.\n');
}

export function validSkill(): Asset {
  return skill({
    name: 'writing-tests',
    location: '.agents/skills',
    frontmatter: { name: 'writing-tests', description: 'Write failing tests before implementation.' },
    body: 'Write the failing test first.\n',
  });
}

export function harnessConfig(harnesses: string[]): Asset {
  return raw('harness-hub.yaml', `harnesses:\n${harnesses.map((h) => `  - ${h}`).join('\n')}\n`);
}
