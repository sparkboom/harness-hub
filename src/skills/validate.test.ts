import { describe, it, expect } from 'vitest';
import { validateSkillFrontmatter } from './validate';

describe('validateSkillFrontmatter', () => {
  it('passes a valid skill', () => {
    const issues = validateSkillFrontmatter('writing-tests', {
      name: 'writing-tests',
      description: 'How to write tests.',
    });
    expect(issues).toEqual([]);
  });

  it('flags a missing name', () => {
    const issues = validateSkillFrontmatter('writing-tests', { description: 'x' });
    expect(issues.map((i) => i.code)).toContain('missing-name');
  });

  it('flags an invalid name format (uppercase)', () => {
    const issues = validateSkillFrontmatter('Writing-Tests', { name: 'Writing-Tests', description: 'x' });
    expect(issues.map((i) => i.code)).toContain('invalid-name-format');
  });

  it('flags consecutive hyphens', () => {
    const issues = validateSkillFrontmatter('writing--tests', { name: 'writing--tests', description: 'x' });
    expect(issues.map((i) => i.code)).toContain('invalid-name-format');
  });

  it('flags a name that does not match its directory', () => {
    const issues = validateSkillFrontmatter('writing-tests', { name: 'other-name', description: 'x' });
    expect(issues.map((i) => i.code)).toContain('name-mismatch');
  });

  it('flags a missing description', () => {
    const issues = validateSkillFrontmatter('writing-tests', { name: 'writing-tests' });
    expect(issues.map((i) => i.code)).toContain('missing-description');
  });

  it('flags a description over 1024 chars', () => {
    const issues = validateSkillFrontmatter('writing-tests', {
      name: 'writing-tests',
      description: 'x'.repeat(1025),
    });
    expect(issues.map((i) => i.code)).toContain('description-length');
  });
});
