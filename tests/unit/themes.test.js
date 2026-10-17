import { describe, it, expect } from 'vitest';
import { resolveTheme, THEME_NAMES } from '../../src/render/themes/index.js';

describe('theme catalog', () => {
  it('exposes 15+ named themes', () => {
    expect(THEME_NAMES.length).toBeGreaterThan(15);
    expect(THEME_NAMES).toContain('default');
    expect(THEME_NAMES).toContain('radical');
    expect(THEME_NAMES).toContain('dracula');
    expect(THEME_NAMES).toContain('nord');
  });

  it('resolves a known theme', () => {
    expect(resolveTheme('radical').title).toBe('#fe428e');
  });

  it('falls back to default for unknown theme', () => {
    expect(resolveTheme('nope-not-a-theme').bg).toBe(resolveTheme('default').bg);
  });

  it('applies legacy generic overrides (bg_color, text_color, ...)', () => {
    const t = resolveTheme('default', { bg_color: '#123456' });
    expect(t.bg).toBe('#123456');
  });

  it('applies new semantic overrides (ring, fire, chip, ...)', () => {
    const t = resolveTheme('default', { ring: 'ff00ff', fire: '#00ff00' });
    expect(t.ring).toBe('#ff00ff');
    expect(t.fire).toBe('#00ff00');
  });

  it('rejects garbage color input and keeps base', () => {
    const base = resolveTheme('default');
    const t = resolveTheme('default', { bg: 'drop table users' });
    expect(t.bg).toBe(base.bg);
  });
});
