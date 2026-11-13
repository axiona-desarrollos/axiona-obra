// AXIONA OBRA · DWG con un botón: recibe el DXF AutoCAD 2000 del juego de planos que arma el navegador y lo devuelve en DWG.
// La conversión la hace GNU LibreDWG (netlify/bin/dxf2dwg, binario estático). Solo acepta DXF del juego de planos de Axiona Obra.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm, copyFile, chmod, access } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const correr = promisify(execFile);
const MAX = 5.5 * 1024 * 1024;
const err = (m, s) => new Response(JSON.stringify({ error: m }), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

async function binario() {
  const tmp = join(tmpdir(), "dxf2dwg");
  try { await access(tmp, constants.X_OK); return tmp; } catch { /* primera vez en este contenedor */ }
  // en Netlify queda en /var/task/bin (junto a /var/task/functions); en local, en netlify/bin
  const raices = [process.env.LAMBDA_TASK_ROOT, process.cwd(), resolve(".")].filter(Boolean);
  const candidatos = [fileURLToPath(new URL("../bin/dxf2dwg", import.meta.url)), ...raices.flatMap((r) => [join(r, "bin/dxf2dwg"), join(r, "netlify/bin/dxf2dwg")])];
  for (const p of candidatos) {
    try { await access(p); await copyFile(p, tmp); await chmod(tmp, 0o755); return tmp; } catch { /* probar la siguiente */ }
  }
  throw new Error("No se encontró dxf2dwg");
}

export default async (req) => {
  if (req.method !== "POST") return err("Use POST con el DXF", 405);
  const dxf = Buffer.from(await req.arrayBuffer());
  if (!dxf.length || dxf.length > MAX) return err("Tamaño de DXF no válido", 413);
  const cab = dxf.subarray(0, 4000).toString("latin1");
  if (!cab.includes("$ACADVER") || !cab.includes("AC1015") || !dxf.includes("AXIONA OBRA")) return err("Solo se convierten planos de Axiona", 400);
  const nombre = (new URL(req.url).searchParams.get("nombre") || "planos").replace(/[^\w.-]+/g, "-").slice(0, 80).replace(/(\.dwg)?$/i, ".dwg");
  const dir = await mkdtemp(join(tmpdir(), "dwg-"));
  try {
    const ent = join(dir, "in.dxf"), sal = join(dir, "out.dwg");
    await writeFile(ent, dxf);
    await correr(await binario(), ["-y", "-o", sal, ent], { timeout: 20000, maxBuffer: 20 * 1024 * 1024 }).catch((e) => { if (e.killed) throw e; });
    const dwg = await readFile(sal);
    if (dwg.length < 1000 || dwg.subarray(0, 6).toString("latin1") !== "AC1015") return err("La conversión no produjo un DWG válido", 500);
    return new Response(dwg, { headers: { "Content-Type": "image/vnd.dwg", "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch (e) {
    return err("No se pudo convertir: " + String(e?.message || e).slice(0, 200), 500);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

export const config = { path: "/api/dwg" };
