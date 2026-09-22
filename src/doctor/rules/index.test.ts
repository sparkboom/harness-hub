import { describe, it, expect } from 'vitest';
import { ALL_DOCTOR_RULES } from './index';

describe('ALL_DOCTOR_RULES', () => {
  it('registers exactly the 9 rule modules backing spec §9 plus R4 version-status, each with a unique id', () => {
    const ids = ALL_DOCTOR_RULES.map((r) => r.id);
    expect(ids).toEqual([
      'canon-presence',
      'config-validity',
      'skill-shape',
      'skill-frontmatter',
      'clobber-risk',
      'skill-migration',
      'trust-gate',
      'generated-file-drift',
      'version-status',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
