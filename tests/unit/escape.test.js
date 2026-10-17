import { describe, it, expect } from 'vitest';
import { escapeXml } from '../../src/utils/escape.js';

describe('escapeXml', () => {
  it('escapes XML metacharacters', () => {
    expect(escapeXml('<script>&</script>')).toBe('&lt;script&gt;&amp;&lt;/script&gt;');
  });
  it('escapes quotes and apostrophes', () => {
    expect(escapeXml(`"'`)).toBe('&quot;&apos;');
  });
  it('returns empty string for null/undefined', () => {
    expect(escapeXml(null)).toBe('');
    expect(escapeXml(undefined)).toBe('');
  });
  it('resists injection via SVG payload', () => {
    const malicious = `"><script>alert(1)</script>`;
    const out = escapeXml(malicious);
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('"');
  });
  it('converts numbers to strings', () => {
    expect(escapeXml(42)).toBe('42');
  });
});
