import { describe, it, expect } from 'vitest';
import { CAPITULOS, VIDEO_TUTORIAL } from '../src/ui/tutorial.js';

describe('tutorial en video', () => {
  it('el video sale de jsDelivr fijado a un commit (no gasta ancho de banda del sitio)', () => {
    expect(VIDEO_TUTORIAL).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/axiona-desarrollos\/axiona-obra@[0-9a-f]{40}\/medios\/.+\.mp4$/);
  });
  it('los capítulos van en orden, dentro del video, con los nueve pasos', () => {
    const t = CAPITULOS.map(c => c[0]);
    expect(t[0]).toBe(0);
    t.slice(1).forEach((s, i) => expect(s).toBeGreaterThan(t[i]));
    expect(t.at(-1)).toBeLessThan(176);
    expect(CAPITULOS.filter(c => /^\d/.test(c[1].es))).toHaveLength(9);
  });
});
