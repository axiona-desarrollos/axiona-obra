/* ==========================================================================
   AXIONA TOPO · Puntos de una estacion total o de otro programa
   --------------------------------------------------------------------------
   Lee archivos de texto con un punto por linea: PNEZD (punto, norte, este,
   cota, descripcion), PENZD o XYZ. Acepta coma, punto y coma, tabulador o
   espacios entre columnas, y coma decimal si el separador no es la coma.
   Las coordenadas quedan relativas al primer punto. Los puntos cuya
   descripcion habla de lindero, esquina o mojon se toman como esquinas.
   ========================================================================== */

const ESQUINA = /lind|esq|moj[oó]n|v[eé]rt|l[ií]m/i;

export function leerPuntos(texto, formato = 'auto') {
  const filas = String(texto || '').replace(/^﻿/, '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^[#;/]/.test(l));
  if (!filas.length) return { puntos: [], aviso: 'El archivo está vacío.' };
  const muestra = filas.slice(0, 5).join('\n');
  const sep = muestra.includes('\t') ? '\t' : muestra.includes(';') ? ';' : muestra.includes(',') ? ',' : /\s+/;
  const comaDecimal = sep !== ',';
  const n = t => { const s = String(t ?? '').trim(); if (!s) return NaN; return +(comaDecimal ? s.replace(',', '.') : s); };
  const crudos = [];
  for (const f of filas) {
    const c = f.split(sep).map(s => s.trim());
    if (c.length < 3) continue;
    let fmt = formato;
    if (fmt === 'auto') fmt = c.length >= 4 && Number.isFinite(n(c[1])) && Number.isFinite(n(c[2])) && Number.isFinite(n(c[3])) ? 'PNEZD' : 'XYZ';
    let id, E, N, Z, D;
    if (fmt === 'PNEZD') [id, N, E, Z, D] = [c[0], n(c[1]), n(c[2]), n(c[3]), c.slice(4).join(' ')];
    else if (fmt === 'PENZD') [id, E, N, Z, D] = [c[0], n(c[1]), n(c[2]), n(c[3]), c.slice(4).join(' ')];
    else [id, E, N, Z, D] = ['', n(c[0]), n(c[1]), n(c[2]), c.slice(3).join(' ')];
    if (!Number.isFinite(E) || !Number.isFinite(N)) continue;
    crudos.push({ id: String(id).slice(0, 16), E, N, Z: Number.isFinite(Z) ? Z : null, D: String(D || '').slice(0, 60) });
  }
  if (!crudos.length) return { puntos: [], aviso: 'No encontré puntos con coordenadas en el archivo.' };
  const o = crudos[0], z0 = crudos.find(p => p.Z !== null)?.Z ?? 0;
  let ne = 0, nn = 0;
  const puntos = crudos.map(p => {
    const tipo = ESQUINA.test(p.D) ? 'esquina' : 'nivel';
    const id = p.id && !/^\d+$/.test(p.id) ? p.id : tipo === 'esquina' ? `P${++ne}` : `N${++nn}`;
    return { id, tipo, x: +(p.E - o.E).toFixed(4), y: +(p.N - o.N).toFixed(4), z: p.Z === null ? null : +(p.Z - z0).toFixed(4), fuente: 'archivo', nota: p.D };
  });
  const sinEsquinas = !puntos.some(p => p.tipo === 'esquina');
  return { puntos, aviso: sinEsquinas ? 'Ningún punto dice «lindero», «esquina» o «mojón»: toque el tipo en la tabla para marcar las esquinas del lote, en orden.' : '' };
}
