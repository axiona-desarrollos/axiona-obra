#!/usr/bin/env python3
"""Recupera el código fuente publicado de un sitio de Netlify y comprueba que es lo que está en línea.

Uso:
  python3 netlify_respaldo.py listar [texto]          # sitios, su publicación y si tienen repositorio
  python3 netlify_respaldo.py bajar SITIO DESTINO [--deploy ID] [--forzar]

SITIO puede ser el nombre del proyecto (axiona-radar), su dominio (axiona-radar.netlify.app,
radarfotomultas.axionasoft.com) o su id.

La clave de Netlify:
- En Claude Code la pone el proxy de la sesión (secreto de red guardado para api.netlify.com).
- Fuera de Claude Code, exporta NETLIFY_AUTH_TOKEN con una clave personal de acceso.
"""
import hashlib
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

API = 'https://api.netlify.com/api/v1/'


def pedir(ruta, crudo=False):
    req = urllib.request.Request(ruta if ruta.startswith('http') else API + ruta)
    token = os.environ.get('NETLIFY_AUTH_TOKEN')
    if token and token != 'proxy-injected' and req.full_url.startswith(API):
        req.add_header('Authorization', 'Bearer ' + token)
    req.add_header('User-Agent', 'axiona-netlify-respaldo')
    with urllib.request.urlopen(req, timeout=60) as r:
        datos = r.read()
    return datos if crudo else json.loads(datos)


def todos(ruta):
    """Recorre las páginas de una lista de la API."""
    out, pagina = [], 1
    sep = '&' if '?' in ruta else '?'
    while True:
        lote = pedir(f'{ruta}{sep}page={pagina}&per_page=100')
        out += lote
        if len(lote) < 100:
            return out
        pagina += 1


def buscar_sitio(s):
    s = s.strip().lower().removeprefix('https://').removeprefix('http://').strip('/')
    if re.fullmatch(r'[0-9a-f-]{36}', s):
        return pedir(f'sites/{s}')
    nombre = s.split('.netlify.app')[0] if s.endswith('.netlify.app') else s
    for st in todos('sites?filter=all'):
        dominios = {st.get('name'), st.get('custom_domain'), *(st.get('domain_aliases') or [])}
        if nombre in dominios or s in dominios:
            return st
    sys.exit(f'No encontré el sitio «{s}» en esta cuenta de Netlify.')


def listar(filtro=''):
    filas = []
    for st in todos('sites?filter=all'):
        if filtro and filtro.lower() not in (st.get('name', '') + ' ' + (st.get('custom_domain') or '')).lower():
            continue
        repo = ((st.get('build_settings') or {}).get('repo_url')) or ''
        dep = st.get('published_deploy') or {}
        filas.append((st.get('updated_at', '')[:10], st['name'], st.get('custom_domain') or '', repo or 'SIN REPOSITORIO', dep.get('id', '')))
    for f in sorted(filas, reverse=True):
        print(' | '.join(f))
    print(f'\n{len(filas)} sitios · {sum(1 for f in filas if f[3] == "SIN REPOSITORIO")} sin repositorio conectado')


def sha1(p):
    h = hashlib.sha1()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 16), b''):
            h.update(b)
    return h.hexdigest()


def carpeta_publicada(destino):
    toml = destino / 'netlify.toml'
    if toml.exists():
        m = re.search(r'^\s*publish\s*=\s*"([^"]*)"', toml.read_text(errors='ignore'), re.M)
        if m:
            return destino / m.group(1)
    for c in ('dist', 'public', 'build', '_site', 'out', '.'):
        if (destino / c / 'index.html').exists():
            return destino / c
    return destino


def extraer_seguro(zip_path, destino):
    with zipfile.ZipFile(zip_path) as z:
        for m in z.infolist():
            ruta = (destino / m.filename).resolve()
            if not str(ruta).startswith(str(destino.resolve()) + os.sep) and ruta != destino.resolve():
                sys.exit(f'El zip trae una ruta peligrosa: {m.filename}')
        z.extractall(destino)
        return len(z.infolist())


def bajar(sitio, destino, deploy_id=None, forzar=False):
    st = buscar_sitio(sitio)
    destino = Path(destino)
    if destino.exists() and any(destino.iterdir()) and not forzar:
        sys.exit(f'{destino} no está vacía. Usa una carpeta nueva o --forzar.')
    destino.mkdir(parents=True, exist_ok=True)
    deploy_id = deploy_id or (st.get('published_deploy') or {}).get('id')
    if not deploy_id:
        sys.exit('El sitio no tiene una publicación activa.')
    dep = pedir(f'deploys/{deploy_id}')
    print(f'Sitio: {st["name"]} ({st.get("ssl_url") or st.get("url")})')
    print(f'Publicación: {deploy_id} · {dep.get("created_at", "")[:16]} · {dep.get("title") or dep.get("commit_ref") or ""}')
    repo = (st.get('build_settings') or {}).get('repo_url')
    if repo:
        print(f'Ojo: este sitio se publica desde {repo} (rama {dep.get("branch")}). El código ya está en ese repositorio.')

    funciones = [f.get('n') for f in dep.get('available_functions') or []]
    fuente = False
    try:
        enlace = pedir(f'deploys/{deploy_id}/download').get('url')
        if enlace:
            with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as tmp:
                tmp.write(pedir(enlace, crudo=True))
            n = extraer_seguro(tmp.name, destino)
            os.unlink(tmp.name)
            fuente = True
            print(f'Código fuente: {n} entradas del zip que Netlify guardó de esta publicación.')
    except urllib.error.HTTPError as e:
        if e.code not in (404, 422):
            raise
    if not fuente:
        # Sin copia fuente (por ejemplo, «netlify deploy» con archivos sueltos): solo se recupera lo publicado.
        print('Netlify no guardó el código fuente de esta publicación: bajo solo los archivos publicados.')
        base = f'https://{deploy_id}--{st["name"]}.netlify.app'
        for f in todos(f'deploys/{deploy_id}/files'):
            p = destino / 'publicado' / f['path'].lstrip('/')
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(pedir(base + urllib.parse.quote(f['path']), crudo=True))
        if funciones:
            print(f'FALTAN las funciones del servidor ({", ".join(funciones)}): no se pueden recuperar sin la copia fuente.')

    # Comprobación: cada archivo publicado contra el código recuperado (SHA-1, como lo guarda Netlify).
    pub = carpeta_publicada(destino) if fuente else destino / 'publicado'
    publicados = todos(f'deploys/{deploy_id}/files')
    # Netlify guarda las rutas en minúsculas: se buscan sin distinguir mayúsculas,
    # primero en la carpeta publicada y luego en la raíz (netlify.toml, _headers…).
    indice = {}
    for base in (destino, pub):
        for p in base.rglob('*'):
            if p.is_file() and '.git' not in p.parts and 'node_modules' not in p.parts:
                indice['/' + p.relative_to(base).as_posix().lower()] = p
    iguales, distintos, faltan = 0, [], []
    for f in publicados:
        local = indice.get(f['path'].lower())
        if not local:
            faltan.append(f['path'])
        elif sha1(local) == f.get('sha'):
            iguales += 1
        else:
            distintos.append(f['path'])
    print(f'Comprobación contra lo publicado ({pub.relative_to(destino) if pub != destino else "."}/): {iguales} de {len(publicados)} archivos idénticos.')
    for p in distintos:
        print('  distinto (puede ser normal si el build lo transforma):', p)
    for p in faltan:
        print('  no está en el código (lo genera el build o se subió aparte):', p)
    if funciones:
        print('Funciones del servidor en la publicación:', ', '.join(funciones), '· incluidas' if fuente else '· NO incluidas')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('listar', 'bajar'):
        sys.exit(__doc__)
    if a[0] == 'listar':
        listar(a[1] if len(a) > 1 else '')
    else:
        if len(a) < 3:
            sys.exit(__doc__)
        dep = a[a.index('--deploy') + 1] if '--deploy' in a else None
        bajar(a[1], a[2], dep, '--forzar' in a)
