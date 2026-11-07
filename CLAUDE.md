# Axiona Obra: reglas para cualquier sesión de Claude

Santiago trabaja este repositorio y sus sitios de Netlify desde **dos cuentas de Claude Code**. Lo que una sesión publica puede no estar en `main`. Antes de tocar algo, mira qué se hizo.

## Antes de desplegar en Netlify

1. Revisa las ramas recientes (`git fetch` y `git for-each-ref --sort=-committerdate refs/remotes`) y los PR abiertos.
2. Revisa el despliegue que está en producción (Netlify: proyecto y despliegue actual). Las subidas directas dicen «Deploy triggered by upload» y no traen commit.
3. **Compara lo publicado con lo que vas a subir.** Compila la rama y mira si el paquete principal de `dist/assets/index-*.js` tiene el mismo nombre que el del `index.html` publicado. Si producción tiene algo que tu rama no tiene, no despliegues: primero junta las ramas.
4. Despliega solo una rama con todo lo de producción, con las pruebas pasando (`npx vitest run`) y el build limpio.

## Estado al 7 de noviembre de 2026

| Sitio | Proyecto de Netlify | Qué está publicado |
|---|---|---|
| obra.axionasoft.com | `axiona-obra` | La rama `claude/axiona-promotional-videos-zdxwnh`: `main` más Axiona Radar, la verificación de Google Search Console y una skill. **Va adelante de `main`.** Desplegar desde `main` borraría Radar y la verificación de Google. |
| axiona-topo.netlify.app | `axiona-topo` | Igual a `main` (`topo/`). |

## Al automatizar el navegador contra sitios publicados

Bloquea `axiona-radar.netlify.app` en la sesión (por ejemplo, `ctx.route(/axiona-radar\.netlify\.app/, r => r.abort())` en Playwright) para que las pruebas no cuenten como visitas.

## Datos de clientes

El repositorio es público. No subas nombres de clientes, grabaciones originales, planos ni fotos de obras de terceros.
