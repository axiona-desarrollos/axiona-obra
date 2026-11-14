import { describe, it, expect } from 'vitest';
import { CAPITULOS, VIDEO_TUTORIAL } from '../src/ui/tutorial.js';

describe('tutorial en video', () => {
  it('el video sale de jsDelivr fijado a un commit (no gasta ancho de banda del sitio)', () => {
    expect(VIDEO_TUTORIAL).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/axiona-desarrollos\/axiona-obra@[0-9a-f]{40}\/medios\/.+\.mp4$/);
  });
  it('los capítulos van en orden, dentro del video (2:24), con los ocho pasos del boceto a la mansión', () => {
    const t = CAPITULOS.map(c => c[0]);
    expect(t[0]).toBe(0);
    t.slice(1).forEach((s, i) => expect(s).toBeGreaterThan(t[i]));
    expect(t.at(-1)).toBeLessThan(144);
    expect(CAPITULOS.filter(c => /^\d/.test(c[1].es))).toHaveLength(8);
    CAPITULOS.forEach(([, n]) => { expect(n.es).toBeTruthy(); expect(n.en).toBeTruthy(); });
  });
});
