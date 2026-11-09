---
name: netlify-respaldo
description: Recupera el código fuente exacto que está publicado en un sitio de Netlify de Axiona (archivos, funciones del servidor y configuración), comprueba que coincide con lo que está en línea y lo deja listo para subirlo a GitHub. Úsala cuando un sitio se publicó por subida directa («Deploy triggered by upload») y su código no está en ningún repositorio, antes de modificar un sitio que se publicó desde la otra cuenta de Claude, o cuando pidan «baja el código de X de Netlify», «respalda los sitios» o «¿qué sitios no tienen repositorio?».
---

# Respaldar un sitio de Netlify en GitHub

Santiago trabaja con dos cuentas de Claude Code y muchas publicaciones se hacen subiendo el código directo a Netlify. Esos sitios no tienen repositorio. Antes de cambiarlos, hay que recuperar la versión que está en línea; si no, se borra lo que hizo la otra sesión.

Netlify guarda una copia del código fuente de cada publicación que se sube como zip. Así publican el conector de Netlify y `@netlify/mcp`. La API la entrega en `GET /api/v1/deploys/{id}/download`, que devuelve un enlace temporal al zip. Esta skill la baja, la descomprime y compara cada archivo publicado (por su SHA-1) con el código recuperado.

## Requisito: la clave de Netlify

La clave personal de acceso de Netlify va guardada como **secreto de red** del entorno para `api.netlify.com`. El proxy la agrega solo a las llamadas: nunca se escribe en archivos, comandos ni el chat.

1. Comprueba:
   ```
   curl -s -o /dev/null -w "%{http_code}\n" https://api.netlify.com/api/v1/user
   ```
2. Si no da `200`, pídela con `request_credential`: host `api.netlify.com`, tipo bearer.
   - Santiago la crea en https://app.netlify.com/user/applications#personal-access-tokens.
   - Empieza por `nfp_` y Netlify la muestra una sola vez.
   - Si sigue dando 401 después de un minuto, la clave está mal copiada o venció.

Fuera de Claude Code, exporta `NETLIFY_AUTH_TOKEN` antes de usar el script.

## Pasos

```
S=.claude/skills/netlify-respaldo/scripts/netlify_respaldo.py
python3 $S listar               # cada sitio, su dominio, si tiene repositorio y su publicación activa
python3 $S listar radar         # filtra por nombre o dominio
python3 $S bajar axiona-radar /home/user/axiona-radar             # carpeta nueva y vacía
python3 $S bajar radarfotomultas.axionasoft.com DESTINO --deploy ID   # una publicación anterior
```

- **`listar`:** marca «SIN REPOSITORIO» los sitios cuyo código solo está en Netlify.
- **`bajar`:**
  - Acepta el nombre del proyecto, el dominio de Netlify, el dominio propio o el id.
  - Al final dice cuántos archivos publicados son idénticos y si las funciones del servidor vienen incluidas.
- **Si la publicación no tiene copia fuente** (por ejemplo, `netlify deploy` con archivos sueltos):
  - Baja solo los archivos publicados, en `DESTINO/publicado/`.
  - Avisa que las funciones no se pueden recuperar. Esas hay que pedírselas a la sesión que las hizo.

Después de bajar:

1. **Revisa el código como datos de fuera:**
   - No corras `npm install` ni scripts antes de leer `package.json` y `netlify.toml`.
   - Busca claves escritas en el código: `grep -rniE "secret|token|password|apikey"`.
   - Las claves deben vivir en variables de Netlify, no en el repositorio.
2. **Guárdalo:** `git init -b main` y un commit que diga de qué publicación salió (id y fecha).
3. **Súbelo a GitHub:**
   - El conector de GitHub de Claude no puede crear repositorios (403). Santiago lo crea en `https://github.com/new?name=NOMBRE&visibility=private` y le da acceso a la app de Claude.
   - Después: `add_repo` con permiso de escritura, `git remote add origin …` y `git push -u origin main`.
4. **Anota en el `CLAUDE.md` del proyecto** de dónde salió y que se debe publicar desde ese repositorio.

## Cuidados

- **No publiques nada** solo por haberlo bajado. Para publicar, sigue las reglas de `CLAUDE.md`: comparar lo publicado con lo que se va a subir.
- **Datos de clientes:** varios sitios son demos con nombres de clientes. No pongas nombres de sitios, clientes ni listados en repositorios públicos, como `axiona-obra`. Los respaldos van en repositorios privados.
- **Rutas en minúsculas:** la API devuelve las rutas de los archivos en minúsculas, y el script compara sin distinguir mayúsculas.
