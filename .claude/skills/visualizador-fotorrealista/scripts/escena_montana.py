# EJEMPLO DE REFERENCIA · Casa Montana (Editec) en Blender Cycles, construida desde los planos (fase final).
# Para otro proyecto: copiar, cambiar MUROS/LOSAS/CUBIERTA y la lista de muebles. No mezclar activos entre clientes.
import bpy, bmesh, math, os, random, sys
from mathutils import Vector, Matrix, noise

F = os.environ.get('AXV_TRABAJO', os.getcwd())
PH = F + '/ph'
OLD = os.environ.get('AXV_EXTRA', F + '/extra')  # texturas propias (montana-demo/public/tex) y muebles glTF (modelos/fuente)
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ------------------------------------------------------------------ materiales
def tex(nt, path, noncolor=False, proj='FLAT'):
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = bpy.data.images.load(path, check_existing=True)
    if noncolor: n.image.colorspace_settings.name = 'Non-Color'
    n.projection = proj
    if proj == 'BOX': n.projection_blend = 0.2
    return n

def pbr(name, folder, period=1.0, tint=None, rough=(0.0, 1.0), bump=0.0, nrm=1.0, sat=1.0, val=1.0, spec=0.5, hue=0.5, use_disp_bump=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1 / period, 1 / period, 1 / period)
    nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
    d = f'{PH}/tex/{folder}/{folder}_'
    c = tex(nt, d + 'Diffuse_2k.jpg'); nt.links.new(mp.outputs[0], c.inputs[0])
    hsv = nt.nodes.new('ShaderNodeHueSaturation'); hsv.inputs['Saturation'].default_value = sat; hsv.inputs['Value'].default_value = val; hsv.inputs['Hue'].default_value = hue
    nt.links.new(c.outputs[0], hsv.inputs['Color'])
    col = hsv.outputs[0]
    if tint:
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
        mix.inputs[7].default_value = (*tint, 1)
        nt.links.new(col, mix.inputs[6]); col = mix.outputs[2]
    nt.links.new(col, bs.inputs['Base Color'])
    r = tex(nt, d + 'Rough_2k.jpg', True); nt.links.new(mp.outputs[0], r.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs[3].default_value = rough[0]; mr.inputs[4].default_value = rough[1]
    nt.links.new(r.outputs[0], mr.inputs[0]); nt.links.new(mr.outputs[0], bs.inputs['Roughness'])
    nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = nrm
    n = tex(nt, d + 'nor_gl_2k.jpg', True); nt.links.new(mp.outputs[0], n.inputs[0]); nt.links.new(n.outputs[0], nm.inputs['Color'])
    nout = nm.outputs[0]
    if bump > 0 and os.path.exists(d + 'Displacement_2k.jpg'):
        h = tex(nt, d + 'Displacement_2k.jpg', True); nt.links.new(mp.outputs[0], h.inputs[0])
        b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = bump; b.inputs['Distance'].default_value = 0.02
        nt.links.new(h.outputs[0], b.inputs['Height']); nt.links.new(nm.outputs[0], b.inputs['Normal']); nout = b.outputs[0]
    nt.links.new(nout, bs.inputs['Normal'])
    bs.inputs['Specular IOR Level'].default_value = spec
    return m

def lisa(name, color, rough=0.5, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*color, 1); bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = metal
    bs.inputs['Coat Weight'].default_value = coat
    return m

def oldtex(name, folder, period, tint=None, rough=None, nrm=1.0):
    """Texturas de la demo anterior (color/normal/rough)."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1 / period,) * 3
    nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
    d = f'{OLD}/montana-demo/public/tex/{folder}/'
    c = tex(nt, d + 'color.jpg'); nt.links.new(mp.outputs[0], c.inputs[0])
    col = c.outputs[0]
    if tint:
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
        mix.inputs[7].default_value = (*tint, 1); nt.links.new(col, mix.inputs[6]); col = mix.outputs[2]
    nt.links.new(col, bs.inputs['Base Color'])
    r = tex(nt, d + 'rough.jpg', True); nt.links.new(mp.outputs[0], r.inputs[0])
    if rough:
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs[3].default_value = rough[0]; mr.inputs[4].default_value = rough[1]
        nt.links.new(r.outputs[0], mr.inputs[0]); nt.links.new(mr.outputs[0], bs.inputs['Roughness'])
    else: nt.links.new(r.outputs[0], bs.inputs['Roughness'])
    nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = nrm
    n = tex(nt, d + 'normal.jpg', True); nt.links.new(mp.outputs[0], n.inputs[0]); nt.links.new(n.outputs[0], nm.inputs['Color'])
    nt.links.new(nm.outputs[0], bs.inputs['Normal'])
    return m

def vidrio():
    m = bpy.data.materials.new('vidrio'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.inputs[0].default_value = (0.86, 0.9, 0.9, 1)
    gl = nt.nodes.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = 0.015; gl.inputs['Color'].default_value = (1, 1, 1, 1)
    fr = nt.nodes.new('ShaderNodeFresnel'); fr.inputs['IOR'].default_value = 1.52
    mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(fr.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(gl.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs['Surface'])
    return m

def emisivo(name, color, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*color, 1); bs.inputs['Emission Color'].default_value = (*color, 1); bs.inputs['Emission Strength'].default_value = strength
    return m

CAL = (1.0, 0.64, 0.34)       # ~2800 K
CAL2 = (1.0, 0.56, 0.26)      # ~2500 K

MAT = {
    'estuco': pbr('estuco', 'plastered_wall_04', 2.4, tint=(0.80, 0.78, 0.75), rough=(0.6, 0.95), nrm=0.6, sat=0.3),
    'estucoOsc': pbr('estucoOsc', 'plastered_wall_04', 2.4, tint=(0.22, 0.22, 0.23), rough=(0.6, 0.95), nrm=0.6, sat=0.2),
    'yeso': pbr('yeso', 'plastered_wall_04', 3.0, tint=(1.0, 0.99, 0.97), rough=(0.7, 0.95), nrm=0.15, sat=0.0, val=1.25),
    'laja': pbr('laja', 'monastery_stone_floor', 1.6, tint=(0.62, 0.66, 0.70), rough=(0.45, 0.9), bump=0.9, nrm=1.4, sat=0.12, val=0.8),
    'lamina': lisa('lamina', (0.32, 0.33, 0.35), 0.38, 0.85),
    'aluminio': lisa('aluminio', (0.035, 0.036, 0.04), 0.32, 0.85),
    'metalOsc': lisa('metalOsc', (0.05, 0.052, 0.055), 0.45, 0.7),
    'vidrio': vidrio(),
    'maderaCielo': oldtex('maderaCielo', 'maderaMiel', 1.4, tint=(0.95, 0.82, 0.68), rough=(0.45, 0.7)),
    'puerta': oldtex('puerta', 'robleClaro', 1.1, tint=(0.95, 0.85, 0.7), rough=(0.35, 0.6)),
    'pisoMadera': pbr('pisoMadera', 'laminate_floor_03', 1.8, rough=(0.2, 0.45), nrm=0.5, sat=0.7, val=0.95),
    'porcelanato': oldtex('porcelanato', 'microGris', 2.4, tint=(0.9, 0.89, 0.87), rough=(0.15, 0.35), nrm=0.2),
    'anden': pbr('anden', 'concrete_tiles_02', 2.0, tint=(0.82, 0.81, 0.79), rough=(0.6, 1.0), sat=0.3),
    'concreto': pbr('concreto', 'concrete_floor_02', 3.0, tint=(0.62, 0.62, 0.6), rough=(0.55, 0.95), sat=0.15, val=1.25),
    'asfalto': pbr('asfalto', 'asphalt_02', 4.0, rough=(0.5, 0.95), nrm=0.8, val=0.75),
    'bordillo': pbr('bordillo', 'concrete_wall_008', 1.5, tint=(0.7, 0.7, 0.68), rough=(0.6, 0.95), sat=0.2, val=1.1),
    'tierra': pbr('tierra', 'forest_ground_04', 1.6, rough=(0.7, 1.0), bump=0.4, val=0.55),
    'cesped': pbr('cesped', 'leafy_grass', 2.0, rough=(0.6, 1.0), bump=0.3, sat=1.1, val=0.75),
    'grava': pbr('grava', 'forest_ground_04', 0.9, tint=(0.55, 0.55, 0.55), rough=(0.6, 1.0), bump=0.6, sat=0.0, val=1.4),
    'sofa': lisa('sofa', (0.55, 0.52, 0.48), 0.8),
    'luzFoco': emisivo('luzFoco', CAL, 40),
    'luzTira': emisivo('luzTira', CAL, 18),
    'blanco': lisa('blanco', (0.85, 0.85, 0.84), 0.5),
    'negro': lisa('negro', (0.02, 0.02, 0.02), 0.4),
    'cortina': lisa('cortina', (0.85, 0.82, 0.76), 0.9),
}
# cortina translúcida (deja pasar luz cálida)
cm = MAT['cortina'].node_tree.nodes['Principled BSDF']
cm.inputs['Transmission Weight'].default_value = 0.0
cm.inputs['Subsurface Weight'].default_value = 0.0

# ------------------------------------------------------------------ geometría
class Lote:
    def __init__(s): s.bm = {}
    def get(s, mat):
        if mat not in s.bm: s.bm[mat] = bmesh.new()
        return s.bm[mat]
    def poly_prism(s, mat, pts, axis, a0, a1):
        """Prisma: polígono pts (2D) extruido de a0 a a1 a lo largo de axis ('y' o 'x'). pts en (u,z)."""
        bm = s.get(mat)
        def P(u, z, a):
            return Vector((u, a, z)) if axis == 'y' else Vector((a, u, z))
        b = [bm.verts.new(P(u, z, a0)) for u, z in pts]
        t = [bm.verts.new(P(u, z, a1)) for u, z in pts]
        n = len(pts)
        bm.faces.new(list(reversed(b)) if axis == 'y' else b)
        bm.faces.new(t if axis == 'y' else list(reversed(t)))
        for i in range(n):
            j = (i + 1) % n
            f = [b[i], b[j], t[j], t[i]]
            bm.faces.new(f if axis == 'y' else list(reversed(f)))
    def bx(s, mat, x0, x1, y0, y1, z0, z1):
        if x1 - x0 < 1e-4 or y1 - y0 < 1e-4 or z1 - z0 < 1e-4: return
        s.poly_prism(mat, [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], 'y', y0, y1)
    def slope(s, mat, xA, zA, xB, zB, y0, y1, t, up=True):
        """Losa inclinada entre A y B (en el plano XZ), espesor t hacia arriba (normal)."""
        dx, dz = xB - xA, zB - zA; L = math.hypot(dx, dz)
        nx, nz = -dz / L, dx / L
        if nz < 0: nx, nz = -nx, -nz
        if not up: nx, nz = -nx, -nz
        s.poly_prism(mat, [(xA, zA), (xB, zB), (xB + nx * t, zB + nz * t), (xA + nx * t, zA + nz * t)], 'y', y0, y1)
    def build(s, coll, prefix, bevel=0.006):
        objs = []
        for mat, bm in s.bm.items():
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            # UV en metros por eje dominante
            uv = bm.loops.layers.uv.new('UVMap')
            for f in bm.faces:
                n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
                for l in f.loops:
                    p = l.vert.co
                    if ax == 0: l[uv].uv = (p.y, p.z)
                    elif ax == 1: l[uv].uv = (p.x, p.z)
                    else: l[uv].uv = (p.x, p.y)
            me = bpy.data.meshes.new(prefix + mat); bm.to_mesh(me); bm.free()
            me.materials.append(MAT[mat])
            o = bpy.data.objects.new(prefix + mat, me); coll.objects.link(o)
            if bevel and mat not in ('vidrio', 'luzFoco', 'luzTira', 'cortina'):
                b = o.modifiers.new('bisel', 'BEVEL'); b.width = bevel; b.segments = 2; b.limit_method = 'ANGLE'; b.angle_limit = math.radians(35)
                b.use_clamp_overlap = True
            objs.append(o)
        s.bm = {}
        return objs

# ------------------------------------------------------------------ casa (port de casa.js, fase 8)
N1, N2, ALERO, PEND = 2.55, 2.85, 5.45, math.tan(math.radians(40))
A = dict(x0=1.3, x1=6.4, y0=3.05, y1=13.1)
CUMBRE = ALERO + (A['x1'] - A['x0']) / 2 * PEND
XM = (A['x0'] + A['x1']) / 2
E = 0.15
MUROS1 = [
  ['x', 3.05, 1.3, 4.6, 0, N1, E, -1, [[1.7, 2.9, 1.5, 2.3, 'v']]],
  ['y', 4.6, 3.05, 5.8, 0, N1, E, +1, []],
  ['x', 5.8, 4.6, 6.35, 0, N1, E, -1, [[4.8, 5.8, 0, 2.4, 'p'], [5.95, 6.25, 0, 2.4, 'v']]],
  ['x', 5.8, 6.35, 9.6, 0, N1, E, -1, [[6.9, 8.9, 1.0, 2.3, 'v']]],
  ['y', 9.6, 5.8, 8.0, 0, N1, E, +1, []],
  ['x', 8.0, 6.35, 9.6, 0, N1, E, +1, [[6.8, 9.3, 0.9, 2.3, 'v']]],
  ['y', 6.35, 8.0, 9.5, 0, N1, E, +1, [[8.1, 9.4, 0, 2.45, 'g']]],
  ['x', 9.5, 6.35, 9.6, 0, N1, E, -1, [[6.6, 9.35, 0, 2.45, 'g']]],
  ['y', 9.6, 9.5, 13.1, 0, N1, E, +1, []],
  ['x', 13.1, 1.3, 9.6, 0, N1, E, +1, [[1.5, 9.4, 0, 2.45, 'g']]],
  ['y', 1.3, 3.05, 13.1, 0, N1, E, -1, [[8.2, 9.6, 1.1, 2.2, 'v']]],
  ['y', 3.1, 3.05, 5.6, 0, N1, 0.1, 0, [[4.4, 5.2, 0, 2.1, 'h']]],
  ['x', 5.6, 1.3, 4.6, 0, N1, 0.1, 0, [[1.9, 2.7, 0, 2.1, 'h'], [3.5, 4.3, 0, 2.1, 'h']]],
  ['y', 3.1, 5.6, 7.5, 0, N1, 0.1, 0, []],
  ['x', 7.5, 3.1, 4.6, 0, N1, 0.1, 0, []],
  ['y', 4.6, 5.8, 7.5, 0, N1, 0.1, 0, [[6.2, 7.0, 0, 2.1, 'h']]],
  ['y', 6.35, 5.8, 8.0, 0, N1, 0.1, 0, [[6.9, 8.0, 0, 2.4, 'h']]],
]
MUROS2 = [
  ['x', 3.05, 1.3, 6.4, N2, ALERO, E, -1, [[1.55, 4.25, 3.0, 5.25, 'v'], [4.95, 6.25, 3.0, 5.25, 'v']]],
  ['y', 6.4, 3.05, 5.8, N2, ALERO, E, +1, []],
  ['x', 5.8, 6.35, 9.6, N2, ALERO, E, -1, [[6.9, 9.0, 3.3, 5.15, 'v']]],
  ['y', 9.6, 5.8, 8.0, N2, ALERO, E, +1, []],
  ['x', 8.0, 6.35, 9.6, N2, ALERO, E, +1, [[6.8, 9.3, 3.75, 5.15, 'v']]],
  ['y', 6.4, 8.0, 9.5, N2, ALERO, E, +1, []],
  ['x', 9.5, 6.4, 9.6, N2, ALERO, E, -1, [[6.8, 8.0, 3.75, 5.15, 'v']]],
  ['y', 9.6, 9.5, 13.1, N2, ALERO, E, +1, []],
  ['x', 13.1, 1.3, 4.6, N2, ALERO, E, +1, [[1.7, 4.2, 3.2, 5.15, 'v']]],
  ['x', 13.1, 4.6, 9.6, N2, ALERO, E, +1, [[5.0, 8.0, N2, 5.15, 'g'], [8.3, 9.3, 4.3, 5.15, 'v']]],
  ['y', 1.3, 3.05, 13.1, N2, ALERO, E, -1, [[6.6, 7.2, 4.4, 5.15, 'v'], [7.7, 8.3, 4.4, 5.15, 'v']]],
  ['y', 4.6, 3.05, 9.5, N2, ALERO, 0.1, 0, [[4.9, 5.7, N2, 4.95, 'h'], [8.9, 9.4, N2, 4.95, 'h']]],
  ['x', 6.3, 1.3, 4.6, N2, ALERO, 0.1, 0, [[3.6, 4.3, N2, 4.95, 'h']]],
  ['x', 7.45, 1.3, 4.6, N2, ALERO, 0.1, 0, []],
  ['x', 8.6, 1.3, 4.6, N2, ALERO, 0.1, 0, [[3.6, 4.3, N2, 4.95, 'h']]],
  ['y', 4.6, 9.5, 13.1, N2, ALERO, 0.1, 0, []],
  ['x', 9.5, 4.6, 6.4, N2, ALERO, 0.1, 0, [[5.0, 5.9, N2, 4.95, 'h']]],
  ['y', 8.1, 9.5, 13.1, N2, ALERO, 0.1, 0, [[10.6, 11.4, N2, 4.95, 'h']]],
  ['x', 11.5, 8.1, 9.6, N2, ALERO, 0.1, 0, []],
]
PISO1 = [[1.3, 4.6, 3.05, 13.1], [4.6, 6.35, 5.8, 13.1], [6.35, 9.6, 5.8, 8.0], [6.35, 9.6, 9.5, 13.1]]
LOSA2 = [[1.3, 4.6, 3.05, 13.7], [4.6, 6.4, 3.05, 13.7], [6.4, 9.6, 9.5, 13.7]]
CARPORT = dict(x0=6.35, x1=10.9, y0=0.9, y1=5.8)

def partes(a0, a1, z0, z1, vanos):
    v = sorted([[max(a0, h[0]), min(a1, h[1]), max(z0, h[2]), min(z1, h[3])] for h in vanos])
    out = []; a = a0
    for h0, h1, s0, s1 in v:
        if h0 > a: out.append([a, h0, z0, z1])
        if s0 > z0: out.append([h0, h1, z0, s0])
        if s1 < z1: out.append([h0, h1, s1, z1])
        a = max(a, h1)
    if a < a1: out.append([a, a1, z0, z1])
    return out

def muro(L, w, ext='estuco', zext=None):
    eje, c, a0, a1, z0, z1, e, lado, vanos = w
    def pieza(mat, q, d0, d1):
        b0, b1, s0, s1 = q
        if eje == 'x': L.bx(mat, b0, b1, c + d0, c + d1, s0, s1)
        else: L.bx(mat, c + d0, c + d1, b0, b1, s0, s1)
    if lado:
        # núcleo con acabado exterior; capa interior de yeso
        for q in partes(a0, a1, z0, z1, vanos): pieza(ext, q, -e / 2, e / 2)
        for q in partes(a0, a1, z0, z1, vanos):
            pieza('yeso', q, -e / 2 - 0.012, -e / 2) if lado > 0 else pieza('yeso', q, e / 2, e / 2 + 0.012)
        if zext and zext > z1:  # el acabado exterior cubre el borde de la losa
            for q in partes(a0, a1, z1, zext, []):
                pieza(ext, q, e / 2, e / 2 + 0.02) if lado > 0 else pieza(ext, q, -e / 2 - 0.02, -e / 2)
    else:
        for q in partes(a0, a1, z0, z1, vanos): pieza('yeso', q, -e / 2, e / 2)

def ventaneria(L, w, cortinas=False):
    eje, c, _, _, _, _, e, lado, vanos = w
    off = lado * (e / 2 - 0.05) if lado else 0
    def pz(mat, a0, a1, s0, s1, d0, d1):
        if eje == 'x': L.bx(mat, a0, a1, c + off + d0, c + off + d1, s0, s1)
        else: L.bx(mat, c + off + d0, c + off + d1, a0, a1, s0, s1)
    for a0, a1, s0, s1, t in vanos:
        if t == 'h':
            pz('puerta', a0 + 0.02, a1 - 0.02, s0, s1 - 0.02, -0.02, 0.02); continue
        if t == 'p':
            pz('puerta', a0 + 0.05, a1 - 0.05, s0, s1 - 0.05, -0.025, 0.025)
            pz('aluminio', a1 - 0.2, a1 - 0.17, 0.4, 1.9, -0.07, -0.03)  # manija vertical
            pz('aluminio', a0, a0 + 0.05, s0, s1, -0.04, 0.04); pz('aluminio', a1 - 0.05, a1, s0, s1, -0.04, 0.04); pz('aluminio', a0, a1, s1 - 0.05, s1, -0.04, 0.04)
            continue
        m = 0.05
        pz('aluminio', a0, a1, s0, s0 + m, -0.04, 0.04); pz('aluminio', a0, a1, s1 - m, s1, -0.04, 0.04)
        pz('aluminio', a0, a0 + m, s0, s1, -0.04, 0.04); pz('aluminio', a1 - m, a1, s0, s1, -0.04, 0.04)
        n = max(1, round((a1 - a0) / (1.35 if t == 'g' else 1.25)))
        for k in range(1, n):
            a = a0 + (a1 - a0) * k / n; pz('aluminio', a - m / 2, a + m / 2, s0, s1, -0.035, 0.035)
        if t == 'v' and s1 - s0 > 1.7: pz('aluminio', a0, a1, s1 - 0.62 - m / 2, s1 - 0.62 + m / 2, -0.03, 0.03)
        pz('vidrio', a0 + m, a1 - m, s0 + m, s1 - m, -0.003, 0.003)
        if t != 'g' and s0 > 0.5:  # alféizar
            pz('metalOsc', a0 - 0.03, a1 + 0.03, s0 - 0.03, s0, (0.03 if lado > 0 else -0.12), (0.12 if lado > 0 else -0.03))
        if cortinas and lado:  # cortina de lino recogida a un lado (adentro)
            d = -lado * 0.18
            w_ = min(0.55, (a1 - a0) * 0.25)
            pz('cortina', a0 + 0.05, a0 + 0.05 + w_, max(s0, 0.02) if t == 'g' else s0 - 0.1, s1 + 0.05, d - 0.03, d + 0.03)
            pz('cortina', a1 - 0.05 - w_ * 0.6, a1 - 0.05, max(s0, 0.02) if t == 'g' else s0 - 0.1, s1 + 0.05, d - 0.03, d + 0.03)

def casa(coll, prefix, oscuro=False):
    L = Lote()
    ext = 'estucoOsc' if oscuro else 'estuco'
    for x0, x1, y0, y1 in PISO1:
        L.bx('porcelanato', x0, x1, y0, y1, -0.12, 0)
    for x0, x1, y0, y1 in LOSA2:
        L.bx(ext, x0, x1, y0, y1, N1, N2)
        L.bx('pisoMadera', x0 + 0.08, x1 - 0.08, y0 + 0.08, min(y1, 13.02), N2, N2 + 0.012)
        L.bx('yeso', x0 + 0.08, x1 - 0.08, y0 + 0.08, y1 - 0.02, N1 - 0.012, N1)
    # parqueadero cubierto (losa, columnas, jardinera)
    C = CARPORT
    L.bx('estuco', C['x0'], C['x1'], C['y0'], C['y1'], N1 + 0.05, N2 + 0.1)
    for x in (6.5, 10.75): L.bx('estuco', x - 0.11, x + 0.11, 0.95, 1.17, 0, N1 + 0.05)
    L.bx('estuco', C['x0'], C['x1'], C['y0'], C['y0'] + 0.15, N2 + 0.1, 3.35)
    L.bx('estuco', C['x0'], C['x1'], C['y0'] + 0.75, C['y0'] + 0.9, N2 + 0.1, 3.35)
    L.bx('estuco', C['x1'] - 0.15, C['x1'], C['y0'], C['y0'] + 0.9, N2 + 0.1, 3.35)
    L.bx('tierra', C['x0'], C['x1'] - 0.15, C['y0'] + 0.15, C['y0'] + 0.75, N2 + 0.1, 3.25)
    L.bx('yeso', C['x0'], C['x1'], C['y0'], C['y1'], N1 + 0.04, N1 + 0.05)
    # muros
    for w in MUROS1:
        zext = N2 if (w[7] and w[1] != 13.1 and w[2] != 13.1) else None
        muro(L, w, ext, zext); ventaneria(L, w)
    for w in MUROS2:
        muro(L, w, ext); ventaneria(L, w)
    # terrazas sobre volúmenes planos
    for x0, x1, y0, y1 in [[6.35, 9.6, 5.8, 8.0], [6.4, 9.6, 9.5, 13.1]]:
        L.bx(ext, x0, x1, y0, y1, ALERO, ALERO + 0.25)
        L.bx('yeso', x0 + 0.05, x1 - 0.05, y0 + 0.05, y1 - 0.05, ALERO - 0.012, ALERO)
        L.bx(ext, x0, x1, y0 - 0.02, y0 + 0.13, ALERO, 6.0); L.bx(ext, x0, x1, y1 - 0.13, y1 + 0.02, ALERO, 6.0)
        L.bx(ext, x1 - 0.13, x1 + 0.02, y0, y1, ALERO, 6.0)
        L.bx('grava', x0 + 0.05, x1 - 0.13, y0 + 0.13, y1 - 0.13, ALERO + 0.25, ALERO + 0.29)
    # ---- volumen A: cubierta en lámina con engargolado, cielo de madera y marco "portal"
    x0, x1, y0, y1 = A['x0'], A['x1'], A['y0'], A['y1']
    ov = 0.45
    L.slope('lamina', x0 - ov, ALERO - ov * PEND, XM, CUMBRE, y0 - 0.55, y1 + 0.55, 0.06)
    L.slope('lamina', XM, CUMBRE, x1, ALERO, y0 - 0.55, y1 + 0.55, 0.06)
    # engargolado (nervios) cada 0.45 m
    yy = y0 - 0.5
    while yy < y1 + 0.5:
        for (xa, za, xb, zb) in [(x0 - ov, ALERO - ov * PEND, XM, CUMBRE), (XM, CUMBRE, x1, ALERO)]:
            dx, dz = xb - xa, zb - za; Ln = math.hypot(dx, dz); nx, nz = -dz / Ln, dx / Ln
            if nz < 0: nx, nz = -nx, -nz
            L.slope('lamina', xa + nx * 0.06, za + nz * 0.06, xb + nx * 0.06, zb + nz * 0.06, yy - 0.012, yy + 0.012, 0.035)
        yy += 0.45
    L.slope('maderaCielo', x0 - ov, ALERO - ov * PEND - 0.02, XM, CUMBRE - 0.02, y0 - 0.55, y1 + 0.55, 0.02, up=False)
    L.slope('maderaCielo', XM, CUMBRE - 0.02, x1, ALERO - 0.02, y0 - 0.55, y1 + 0.55, 0.02, up=False)
    # marco portal en estuco (frente y fondo): grueso 0.32, profundidad 0.7
    T = 0.32
    for (ya, yb) in [(y0 - 0.75, y0 - 0.05), (y1 + 0.05, y1 + 0.75)]:
        L.slope(ext, x0 - T, ALERO - T * PEND + 0.0, XM, CUMBRE + 0.0, ya, yb, T + 0.1)
        L.slope(ext, XM, CUMBRE, x1 + T, ALERO - T * PEND, ya, yb, T + 0.1)
        L.bx(ext, x0 - T, x0, ya, yb, N1, ALERO - T * PEND + 0.02)
        L.bx(ext, x1, x1 + T, ya, yb, N1, ALERO - T * PEND + 0.02)
        L.bx(ext, x0 - T, x1 + T, ya, yb, N1 - 0.0, N2 + 0.1)
    # vigas laterales del portal (unen frente y fondo bajo el alero)
    # culatas acristaladas con parales
    for yc in (y0, y1):
        pts = [(x0 + 0.05, ALERO), (x1 - 0.05, ALERO), (XM, CUMBRE - 0.1)]
        L.poly_prism('vidrio', pts, 'y', yc - 0.003, yc + 0.003)
        nP = 6; step = (x1 - x0 - 0.1) / nP
        for k in range(nP + 1):
            x = x0 + 0.05 + k * step
            h = ALERO + (CUMBRE - ALERO) * (1 - abs(x - XM) / (XM - x0)) - 0.08
            if h > ALERO + 0.05: L.bx('aluminio', x - 0.025, x + 0.025, yc - 0.04, yc + 0.04, ALERO, h)
        L.bx('aluminio', x0, x1, yc - 0.05, yc + 0.05, ALERO - 0.1, ALERO + 0.06)
        L.slope('aluminio', x0, ALERO, XM, CUMBRE - 0.06, yc - 0.045, yc + 0.045, 0.06, up=False)
        L.slope('aluminio', XM, CUMBRE - 0.06, x1, ALERO, yc - 0.045, yc + 0.045, 0.06, up=False)
    # piedra laja: franja vertical que sube hasta la cumbre, zócalo del cuarto útil y lateral
    yf = y0 - E / 2 - 0.02
    zr = lambda x: ALERO + (CUMBRE - ALERO) * (1 - abs(x - XM) / (XM - x0))
    L.poly_prism('laja', [(4.3, N1), (4.95, N1), (4.95, zr(4.95) - 0.05), (4.3, zr(4.3) - 0.05)], 'y', yf - 0.06, yf + 0.0)
    L.bx('laja', 9.6 + E / 2, 9.6 + E / 2 + 0.05, 5.8, 8.0, 0, 6.0)
    L.bx('laja', 6.35, 9.65, 5.8 - E / 2 - 0.06, 5.8 - E / 2, 0, 0.9)
    # escalera
    ch, hu = N2 / 16, 0.26
    for i in range(8):
        x = 6.5 + i * hu
        L.bx('porcelanato', x, x + hu, 7.05, 7.95, 0, ch * (i + 1) - 0.03); L.bx('puerta', x - 0.01, x + hu, 7.05, 7.95, ch * (i + 1) - 0.03, ch * (i + 1))
    L.bx('yeso', 8.58, 9.52, 5.88, 7.95, ch * 8 - 0.18, ch * 8 - 0.03); L.bx('puerta', 8.58, 9.52, 5.88, 7.95, ch * 8 - 0.03, ch * 8)
    for i in range(8):
        x = 8.58 - (i + 1) * hu
        L.bx('yeso', x, x + hu, 5.88, 6.85, ch * (9 + i) - 0.18, ch * (9 + i) - 0.03); L.bx('puerta', x, x + hu + 0.01, 5.88, 6.85, ch * (9 + i) - 0.03, ch * (9 + i))
    # balcón trasero con baranda de vidrio
    L.bx('vidrio', 4.6, 9.6, 13.655, 13.665, N2 + 0.05, N2 + 1.05); L.bx('aluminio', 4.6, 9.6, 13.635, 13.685, N2 + 1.03, N2 + 1.07)
    # focos empotrados (discos emisivos) en cielos exteriores: parqueadero, portal y acceso
    for (x, y, z) in [(7.6, 2.4, N1 + 0.039), (9.7, 2.4, N1 + 0.039), (7.6, 4.4, N1 + 0.039), (9.7, 4.4, N1 + 0.039), (5.3, 4.4, N1 - 0.013)]:
        L.bx('luzFoco', x - 0.05, x + 0.05, y - 0.05, y + 0.05, z - 0.004, z)
    for (x0, x1, y0, y1, z) in [(1.4, 4.5, 3.2, 5.5, N1 - 0.012), (1.4, 6.2, 7.6, 13.0, N1 - 0.012), (6.5, 9.5, 9.6, 13.0, N1 - 0.012),
                                 (1.4, 4.5, 3.2, 6.2, ALERO - 0.012), (4.7, 6.3, 3.2, 9.4, ALERO - 0.012), (4.7, 9.5, 9.6, 13.0, ALERO - 0.012)]:
        nx_, ny_ = max(1, round((x1 - x0) / 1.4)), max(1, round((y1 - y0) / 1.4))
        for i in range(nx_):
            for j in range(ny_):
                x = x0 + (x1 - x0) * (i + 0.5) / nx_; y = y0 + (y1 - y0) * (j + 0.5) / ny_
                L.bx('luzFoco', x - 0.045, x + 0.045, y - 0.045, y + 0.045, z - 0.003, z)
    objs = L.build(coll, prefix)
    return objs

col_casa = bpy.data.collections.new('casa'); sc.collection.children.link(col_casa)
casa(col_casa, 'c_')
# mobiliario real (Poly Haven) visible a través de los vidrios
MOD = OLD + '/modelos/fuente'
def mueble(nombre, loc, rz_deg, coll, s=1.0):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f'{MOD}/{nombre}/{nombre}.gltf')
    nuevos = [o for o in bpy.data.objects if o not in antes]
    raiz = bpy.data.objects.new(nombre + '_set', None); coll.objects.link(raiz)
    for o in nuevos:
        for c in list(o.users_collection): c.objects.unlink(o)
        coll.objects.link(o)
        if o.parent is None: o.parent = raiz
    raiz.location = loc; raiz.rotation_euler = (0, 0, math.radians(rz_deg)); raiz.scale = (s, s, s)
z2 = N2 + 0.012
mueble('mid_century_lounge_chair', (3.55, 3.85, z2), 200, col_casa)
mueble('side_table_01', (2.75, 3.6, z2), 0, col_casa)
mueble('potted_plant_01', (1.75, 3.5, z2), 30, col_casa, 1.15)
mueble('potted_plant_02', (5.85, 3.55, z2), 0, col_casa)
mueble('wooden_display_shelves_01', (4.82, 4.6, z2), 0, col_casa)
mueble('sofa_02', (3.4, 10.4, 0), 0, col_casa)
mueble('modern_coffee_table_01', (3.4, 11.5, 0), 90, col_casa)
mueble('modern_arm_chair_01', (1.95, 11.6, 0), -70, col_casa)
mueble('potted_plant_01', (1.65, 12.7, 0), 0, col_casa)
mueble('potted_plant_02', (6.0, 12.75, 0), 0, col_casa)
mueble('coffee_table_round_01', (7.9, 11.2, 0), 0, col_casa)
bpy.data.objects['coffee_table_round_01_set'].scale = (0.85, 0.85, 1.55)
for k, ang in enumerate((0, 90, 180, 270)):
    a = math.radians(ang); mueble('dining_chair_02', (7.9 + 0.85 * math.sin(a), 11.2 - 0.85 * math.cos(a), 0), ang, col_casa)
# lámparas colgantes bajo la cumbre de madera
PL = Lote()
for y in (4.3, 8.3, 12.0):
    PL.bx('negro', XM - 0.006, XM + 0.006, y - 0.006, y + 0.006, 6.25, CUMBRE - 0.1)
    PL.bx('negro', XM - 0.16, XM + 0.16, y - 0.16, y + 0.16, 6.05, 6.25)
    PL.bx('luzFoco', XM - 0.14, XM + 0.14, y - 0.14, y + 0.14, 6.04, 6.05)
PL.build(col_casa, 'lamp_', bevel=0.01)
col_vec = bpy.data.collections.new('casa_vecina'); sc.collection.children.link(col_vec)
casa(col_vec, 'v_', oscuro=True)

# luces interiores y exteriores de la casa (dentro de la colección para que las vecinas también las tengan)
def luz(coll, name, kind, loc, energy, color=CAL, size=0.5, size_y=None, rot=(0, 0, 0), spot=None, blend=0.3, radius=0.02):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
    if kind == 'AREA':
        ld.shape = 'RECTANGLE'; ld.size = size; ld.size_y = size_y or size
    elif kind in ('SPOT', 'POINT'):
        ld.shadow_soft_size = radius
        if kind == 'SPOT': ld.spot_size = math.radians(spot or 60); ld.spot_blend = blend
    o = bpy.data.objects.new(name, ld); o.location = loc; o.rotation_euler = rot; coll.objects.link(o)
    return o

def luces(coll, k=1.0):
    # interiores (rectangulares en cielo, apuntando abajo)
    for (x0, x1, y0, y1, z, e) in [
        (1.4, 4.5, 3.2, 5.5, N1 - 0.03, 90), (1.4, 6.2, 7.6, 13.0, N1 - 0.03, 260), (4.7, 6.2, 5.9, 7.5, N1 - 0.03, 60),
        (6.5, 9.5, 9.6, 13.0, N1 - 0.03, 160), (6.5, 9.5, 5.9, 7.9, N1 - 0.03, 70),
        (1.4, 4.5, 3.2, 6.2, ALERO - 0.05, 110), (4.7, 6.3, 3.2, 9.4, ALERO - 0.05, 90), (1.4, 4.5, 8.7, 13.0, ALERO - 0.05, 120),
        (4.7, 9.5, 9.6, 13.0, ALERO - 0.05, 150), (6.5, 9.5, 5.9, 7.9, ALERO - 0.05, 50)]:
        lo = luz(coll, 'int', 'AREA', ((x0 + x1) / 2, (y0 + y1) / 2, z), e * k, CAL, size=(x1 - x0) * 0.6, size_y=(y1 - y0) * 0.6)
        lo.visible_glossy = False; lo.visible_camera = False
    for y in (4.3, 8.3, 12.0):
        luz(coll, 'colgante', 'POINT', (XM, y, 5.95), 30 * k, CAL2, radius=0.12)
    # bañador del cielo de madera (luz hacia arriba dentro del volumen A)
    for y in (4.0, 8.0, 12.0):
        lo = luz(coll, 'cielo', 'AREA', (XM, y, ALERO + 0.1), 70 * k, CAL2, size=3.5, size_y=2.5, rot=(math.pi, 0, 0))
        lo.visible_glossy = False; lo.visible_camera = False
    # focos exteriores: parqueadero, acceso, rasante a la piedra, bajo el portal
    for (x, y) in [(7.6, 2.4), (9.7, 2.4), (7.6, 4.4), (9.7, 4.4)]:
        luz(coll, 'foco', 'SPOT', (x, y, N1 + 0.02), 55 * k, CAL, spot=70, blend=0.5)
    luz(coll, 'acceso', 'SPOT', (5.3, 4.6, N1 - 0.03), 45 * k, CAL, spot=80, blend=0.5)
    luz(coll, 'piedra', 'SPOT', (4.62, A['y0'] - 0.42, N2 + 0.14), 160 * k, CAL2, spot=14, blend=0.5, radius=0.01)
    luz(coll, 'piedra_fondo', 'SPOT', (4.62, A['y0'] - 0.45, N1 + 0.05), 0, CAL2)
    for x in (2.2, 3.4, 5.6):
        luz(coll, 'portal', 'SPOT', (x, A['y0'] - 0.5, N1 - 0.02), 40 * k, CAL, spot=70, blend=0.6)
    # rasante en la laja lateral del cuarto útil
    luz(coll, 'zocalo', 'SPOT', (8.0, 5.8 - 0.6, 0.05), 25 * k, CAL2, spot=100, blend=0.7, rot=(math.radians(-80), 0, 0))
    # tira LED bajo la jardinera del parqueadero
    luz(coll, 'jardinera', 'AREA', ((CARPORT['x0'] + CARPORT['x1']) / 2, CARPORT['y0'] + 0.45, 3.35), 25 * k, CAL2, size=4.4, size_y=0.3, rot=(math.pi, 0, 0))

luces(col_casa, 2.0)
luces(col_vec, 1.7)
# las rotaciones de las luces 'piedra' apuntan hacia arriba
for c in (col_casa, col_vec):
    for o in c.objects:
        if o.type == 'LIGHT' and o.name.startswith('piedra'):
            o.rotation_euler = (math.radians(180 - 4.5), 0, 0)
        if o.type == 'LIGHT' and o.name.startswith('zocalo'):
            o.rotation_euler = (math.radians(180 - 60), 0, 0)

# instancias de las casas vecinas (serie escalonada, como en el proyecto real)
col_casa.hide_render = False
vec_inst = []
for i, (dx, dz, which) in enumerate([(-11.2, -0.55, col_vec), (11.2, 0.55, col_vec), (22.4, 1.1, col_casa), (-22.4, -1.1, col_casa)]):
    e = bpy.data.objects.new(f'vecina_{i}', None); e.instance_type = 'COLLECTION'; e.instance_collection = which
    e.location = (dx, 0, dz); sc.collection.objects.link(e); vec_inst.append(e)
# la colección vecina solo existe como instancia
lc = bpy.context.view_layer.layer_collection.children['casa_vecina']; lc.exclude = True

# ------------------------------------------------------------------ sitio: vía, andén, antejardín, terreno
S = Lote()
X0, X1 = -40, 50
S.bx('asfalto', X0, X1, -9.0, -1.6, -0.25, -0.15)
S.bx('bordillo', X0, X1, -1.6, -1.45, -0.25, 0.0)
S.bx('anden', X0, X1, -1.45, 0.35, -0.12, 0.0)
S.bx('bordillo', X0, X1, -9.15, -9.0, -0.25, 0.0)
S.bx('anden', X0, X1, -11.0, -9.15, -0.12, 0.0)
for k in range(-4, 5):
    ox = k * 11.2; oz = 0.55 * k if abs(k) <= 2 else 0.55 * k
    # acceso vehicular en concreto
    S.bx('concreto', ox + 6.3, ox + 10.95, 0.35, 5.8, -0.1 + oz * 0, 0.0)
    # antejardín: tierra, césped y sendero
    S.bx('tierra', ox + 0.0, ox + 6.3, 0.35, 3.0, -0.2, -0.02)
    S.bx('concreto', ox + 4.75, ox + 5.85, 0.35, 5.8, -0.1, 0.01)
    S.bx('bordillo', ox + 0.0, ox + 4.75, 0.35, 0.45, -0.1, 0.12)
S.build(sc.collection, 's_', bevel=0.004)

# terreno: plano cerca de las casas, ladera suave detrás y montañas lejanas con bosque
def zt(x, y):
    if y < -0.5: return -0.3
    if y < 26: return -0.05
    h = y - 26
    f = noise.fractal(Vector((x * 0.012, y * 0.012, 0.5)), 0.85, 2.0, 6)
    return -0.05 + 0.09 * h + 0.0007 * h * h + 5.0 * f * min(1, h / 30)
bpy.ops.mesh.primitive_grid_add(x_subdivisions=150, y_subdivisions=110, size=1)
g = bpy.context.active_object; g.name = 'terreno'
g.scale = (240, 170, 1); g.location = (5, 70, 0)
bpy.ops.object.transform_apply(scale=True, location=True)
me = g.data
for v in me.vertices: v.co.z = zt(v.co.x, v.co.y)
me.materials.append(MAT['cesped'])
uvl = me.uv_layers.new(name='UVMap')
for poly in me.polygons:
    for li in poly.loop_indices:
        co = me.vertices[me.loops[li].vertex_index].co; uvl.data[li].uv = (co.x, co.y)
bpy.ops.object.shade_smooth()

# montañas lejanas (silueta con dosel de bosque procedural)
mm = bpy.data.materials.new('montana_bosque'); mm.use_nodes = True
nt = mm.node_tree; bs = nt.nodes['Principled BSDF']
tcm = nt.nodes.new('ShaderNodeTexCoord')
nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.08; nz.inputs['Detail'].default_value = 12; nz.inputs['Roughness'].default_value = 0.65
nt.links.new(tcm.outputs['Object'], nz.inputs['Vector'])
vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 0.35
nt.links.new(tcm.outputs['Object'], vor.inputs['Vector'])
cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].color = (0.006, 0.014, 0.008, 1); cr.color_ramp.elements[1].color = (0.03, 0.05, 0.028, 1)
nt.links.new(nz.outputs['Fac'], cr.inputs['Fac']); nt.links.new(cr.outputs[0], bs.inputs['Base Color'])
bs.inputs['Roughness'].default_value = 0.95
bmp = nt.nodes.new('ShaderNodeBump'); bmp.inputs['Strength'].default_value = 1.0; bmp.inputs['Distance'].default_value = 1.5
nt.links.new(vor.outputs['Distance'], bmp.inputs['Height']); nt.links.new(bmp.outputs[0], bs.inputs['Normal'])
bpy.ops.mesh.primitive_grid_add(x_subdivisions=520, y_subdivisions=180, size=1)
mt = bpy.context.active_object; mt.name = 'montanas'
mt.scale = (1600, 760, 1); mt.location = (0, 560, 0)
bpy.ops.object.transform_apply(scale=True, location=True)
for v in mt.data.vertices:
    x, y = v.co.x, v.co.y
    t = max(0.0, (y - 180) / 760)
    base = 20 + 300 * t ** 0.75
    r = noise.ridged_multi_fractal(Vector((x * 0.0022, y * 0.0022, 1.7)), 0.9, 2.05, 8, 1.0, 2.0)
    f = noise.fractal(Vector((x * 0.009, y * 0.009, 3.1)), 0.7, 2.1, 7)
    v.co.z = base + (62 * r + 30 * f) * min(1, t * 4) - 50
mt.data.materials.append(mm)
bpy.ops.object.shade_smooth()

# ------------------------------------------------------------------ vegetación escaneada (Poly Haven)
veg = bpy.data.collections.new('veg_src'); sc.collection.children.link(veg)
def cargar(blend, names):
    with bpy.data.libraries.load(blend, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n in names]
    out = []
    for o in dst.objects:
        if o is None: continue
        veg.objects.link(o); o.location = (0, 0, 0); out.append(o)
    return out

def src(name, objs):
    c = bpy.data.collections.new(name)
    for o in objs:
        c.objects.link(o)
    return c

P = PH + '/models'
fern = cargar(f'{P}/fern_02/fern_02_1k.blend', ['fern_02_a', 'fern_02_b', 'fern_02_c', 'fern_02_d'])
shr = {}
for s in ('shrub_02', 'shrub_03', 'shrub_04'):
    shr[s] = cargar(f'{P}/{s}/{s}_1k.blend', [f'{s}_{v}_LOD0' for v in 'abcd'])
tree1 = cargar(f'{P}/island_tree_01/island_tree_01_1k.blend', ['island_tree_01_LOD0'])
tree2 = cargar(f'{P}/island_tree_02/island_tree_02_1k.blend', ['island_tree_02_LOD0', 'island_tree_02_LOD1'])
tsm = cargar(f'{P}/tree_small_02/tree_small_02_1k.blend', ['tree_small_02_LOD0'])
grass = cargar(f'{P}/grass_medium_01/grass_medium_01_1k.blend', [f'grass_medium_01_tiny_{v}_LOD1' for v in 'abcdef'])
for o in veg.objects: print('VEG', o.name, tuple(round(d, 2) for d in o.dimensions), len(o.data.polygons) if o.type == 'MESH' else o.type)
lcv = bpy.context.view_layer.layer_collection.children['veg_src']; lcv.exclude = True

def inst(o, loc, s=1.0, rz=None, coll=sc.collection):
    n = bpy.data.objects.new(o.name + '_i', o.data); coll.objects.link(n)
    n.location = loc; n.scale = (s, s, s); n.rotation_euler = (0, 0, random.uniform(0, 6.283) if rz is None else rz)
    return n

col_plant = bpy.data.collections.new('plantas'); sc.collection.children.link(col_plant)
for k in range(-3, 4):
    ox = k * 11.2; oz = 0.55 * k if k else 0.0
    oz = [-1.1, -1.1, -0.55, 0, 0.55, 1.1, 1.1][k + 3] if abs(k) <= 3 else 0
    oz = 0  # el terreno frontal es plano; la escalera de alturas es solo de las casas vecinas cercanas
    # antejardín: seto de arbustos contra la fachada, helechos delante y estacas de luz
    for i in range(6):
        x = ox + 0.5 + i * 0.75 + random.uniform(-0.15, 0.15)
        inst(random.choice(shr['shrub_02']), (x, 2.55 + random.uniform(-0.1, 0.1), -0.05), random.uniform(0.75, 1.0), coll=col_plant)
    for i in range(14):
        x = ox + random.uniform(0.3, 4.6); y = random.uniform(0.75, 2.2)
        inst(random.choice(fern), (x, y, -0.04), random.uniform(0.9, 1.45), coll=col_plant)
    for i in range(10):
        s_ = random.choice([shr['shrub_03'], shr['shrub_04']])
        inst(random.choice(s_), (ox + random.uniform(0.3, 4.6), random.uniform(0.6, 2.0), -0.04), random.uniform(2.0, 3.2), coll=col_plant)
    # arbustos entre el acceso vehicular y la casa vecina
    for i in range(3):
        inst(random.choice(shr['shrub_02']), (ox + 11.0 + random.uniform(-0.1, 0.1), 0.8 + i * 1.1, -0.05), random.uniform(0.7, 0.95), coll=col_plant)
    # jardinera del parqueadero
    for i in range(9):
        inst(random.choice(fern), (ox + 6.6 + i * 0.47, 1.35 + random.uniform(-0.1, 0.1), 3.25), random.uniform(0.55, 0.75), coll=col_plant)
# árboles: uno grande al lado derecho delante, una franja de bosque detrás de las casas
inst(tree1[0], (12.6, 1.5, 0), 1.25, coll=col_plant)
inst(tsm[0], (-0.9, 1.7, 0), 1.0, coll=col_plant)
for i in range(1400):
    x = random.uniform(-140, 150); y = random.uniform(17, 260) if i < 1100 else random.uniform(17, 60)
    if y < 26 and -40 < x < 50: continue
    o = random.choice([tree1[0], tree2[1], tree2[1], tree1[0], tsm[0]]) if y < 80 else random.choice([tree2[1], tree1[0]])
    inst(o, (x, y, zt(x, y) - 0.3), random.uniform(1.2, 2.1) * (1 + max(0, y - 80) / 200), coll=col_plant)
# luces de jardín: estacas que bañan helechos y el árbol del frente, y postes de alumbrado en el andén de enfrente
for k in range(-2, 3):
    ox = k * 11.2
    for xx in (1.0, 2.6, 4.2):
        luz(col_plant, 'jard', 'SPOT', (ox + xx, 1.2, 0.06), 22, CAL2, spot=75, blend=0.9, rot=(math.radians(148), 0, 0), radius=0.03)
la = luz(col_plant, 'arbol', 'SPOT', (11.3, 0.4, 0.1), 160, CAL2, spot=40, blend=0.6)
la.rotation_euler = (Vector((12.6, 1.6, 4.5)) - Vector((11.3, 0.4, 0.1))).to_track_quat('-Z', 'Y').to_euler()
for x in (-12, 6, 24):
    pm = Lote(); pm.bx('metalOsc', x - 0.06, x + 0.06, -9.75, -9.63, -0.1, 4.6); pm.bx('metalOsc', x - 0.07, x + 0.07, -9.75, -8.95, 4.5, 4.62)
    pm.bx('luzFoco', x - 0.05, x + 0.05, -9.25, -8.98, 4.495, 4.5); pm.build(col_plant, 'poste_', bevel=0.004)
    luz(col_plant, 'poste', 'SPOT', (x, -9.1, 4.45), 380, (1.0, 0.82, 0.62), spot=120, blend=0.9, radius=0.05)
# césped con partículas (hierba escaneada) en antejardines y patio trasero
gp = bpy.data.collections.new('grass_set')
for o in grass: gp.objects.link(o)
def cesped(name, x0, x1, y0, y1, z, count):
    bpy.ops.mesh.primitive_plane_add(size=1)
    p = bpy.context.active_object; p.name = name
    p.scale = (x1 - x0, y1 - y0, 1); p.location = ((x0 + x1) / 2, (y0 + y1) / 2, z)
    bpy.ops.object.transform_apply(scale=True, location=True)
    p.data.materials.append(MAT['tierra'])
    uvl = p.data.uv_layers[0]
    for poly in p.data.polygons:
        for li in poly.loop_indices:
            co = p.data.vertices[p.data.loops[li].vertex_index].co; uvl.data[li].uv = (co.x, co.y)
    ps = p.modifiers.new('hierba', 'PARTICLE_SYSTEM').particle_system.settings
    ps.type = 'HAIR'; ps.count = count; ps.hair_length = 1.0; ps.use_advanced_hair = True
    ps.render_type = 'COLLECTION'; ps.instance_collection = gp; ps.use_collection_pick_random = True
    ps.particle_size = 0.55; ps.size_random = 0.5; ps.use_rotations = True; ps.rotation_mode = 'NOR'; ps.phase_factor_random = 2.0
    return p
for k in range(-3, 4):
    ox = k * 11.2
    cesped(f'cesped_{k}', ox + 0.0, ox + 4.7, 0.5, 2.9, -0.02, 900)
cesped('cesped_fondo', -30, 40, 14.0, 26, -0.03, 9000)

sc['meta'] = dict(N1=N1, N2=N2, ALERO=ALERO, CUMBRE=CUMBRE)
bpy.ops.wm.save_as_mainfile(filepath=F + '/montana2.blend')
print('GUARDADO', F + '/montana2.blend')
