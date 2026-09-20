import { describe, it, expect } from 'vitest';
import { ALL_DOCTOR_RULES } from './index';

describe('ALL_DOCTOR_RULES', () => {
  it('registers exactly the 8 rule modules backing spec §9, each with a unique id', () => {
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
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
