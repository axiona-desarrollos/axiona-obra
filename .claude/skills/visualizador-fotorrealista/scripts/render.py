# Render de tomas de la casa Montana. Uso: blender -b montana.blend --python render.py -- toma ancho alto muestras salida.png [frame]
import bpy, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
toma, W, H, SPP, OUT = argv[0], int(argv[1]), int(argv[2]), int(argv[3]), argv[4]
GRIS = toma.endswith('_gris')
toma = toma.replace('_gris', '')
F = os.environ.get('AXV_TRABAJO', os.getcwd())  # carpeta de trabajo: blender/, ph/, .blend
sc = bpy.context.scene

# ---------------------------------------------------------------- motor
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.device = 'CPU'
cy.samples = SPP
cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.015
cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'
try: cy.denoising_prefilter = 'ACCURATE'
except Exception: pass
cy.max_bounces = 8; cy.diffuse_bounces = 3; cy.glossy_bounces = 3; cy.transmission_bounces = 6; cy.transparent_max_bounces = 24
cy.sample_clamp_indirect = 6.0
cy.caustics_reflective = False; cy.caustics_refractive = False
cy.use_light_tree = True
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.render.film_transparent = False
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
sc.render.image_settings.file_format = 'PNG'
sc.render.threads_mode = 'AUTO'

# ---------------------------------------------------------------- cielo (hora azul)
TOMAS = {
    # nombre: (hdri, fuerza, rot_z_grados, exposición, cámara(loc), objetivo, lente_mm, desplazamiento_y)
    'frente':   ('belfast_sunset_puresky', 0.42, 200, 0.75, (0.6, -12.5, 1.6), (5.4, 4.0, 2.9), 24, 0.10),
    'tres4':    ('belfast_sunset_puresky', 0.42, 200, 0.75, (11.2, -7.6, 1.5), (4.6, 5.0, 3.2), 20, 0.08),
    'piedra':   ('belfast_sunset_puresky', 0.42, 200, 0.75, (3.2, -2.4, 1.55), (4.62, 2.9, 5.0), 26, 0.0),
    'aerea':    ('belfast_sunset_puresky', 0.45, 200, 1.0, (-7.0, -27.0, 13.0), (6.0, 10.0, 4.5), 26, 0.0),
    'sala':     ('belfast_sunset_puresky', 0.30, 200, 0.55, (1.75, 8.0, 1.32), (6.2, 13.6, 1.15), 18, 0.04),
    'fondo':    ('belfast_sunset_puresky', 0.55, 20, 0.4, (2.0, 24.5, 1.7), (5.0, 9.0, 3.2), 22, 0.08),
}
# tomas animadas (12 fps): cámara inicial/final, objetivo inicial/final, lente, cuadros, enfoque
ANIM = {
    'anim_llegada': ((5.5, -12.9, 1.45), (5.3, -9.4, 1.6), (5.2, 4.0, 4.2), (5.2, 4.0, 4.35), 20, 36, False),
    'anim_lateral': ((13.6, -6.2, 1.45), (8.4, -7.4, 1.45), (4.4, 5.0, 3.6), (4.6, 5.0, 3.6), 18, 36, False),
    'anim_piedra':  ((3.55, -1.7, 1.5), (3.75, -1.2, 2.6), (4.62, 2.9, 3.4), (4.62, 2.9, 7.2), 22, 30, True),
    'anim_dron':    ((-2.0, -13.0, 3.8), (0.8, -11.5, 12.5), (5.5, 6.0, 3.6), (6.0, 10.0, 4.2), 22, 36, False),
}
if toma in ANIM:
    TOMAS[toma] = ('belfast_sunset_puresky', 0.42, 200, 0.8, ANIM[toma][0], ANIM[toma][2], ANIM[toma][4], 0.0)
hdri, fuerza, rot, expo, cam, obj, lente, shift = TOMAS[toma]
w = bpy.data.worlds.new('mundo'); sc.world = w; w.use_nodes = True
nt = w.node_tree; nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputWorld')
bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = fuerza
env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(f'{F}/ph/hdri/{hdri}_4k.hdr')
tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
mp.inputs['Rotation'].default_value = (0, 0, math.radians(rot))
# hora azul: bajar el tono y empujar al azul
hsv = nt.nodes.new('ShaderNodeHueSaturation'); hsv.inputs['Hue'].default_value = 0.5; hsv.inputs['Saturation'].default_value = 1.15; hsv.inputs['Value'].default_value = 1.0
cb = nt.nodes.new('ShaderNodeMix'); cb.data_type = 'RGBA'; cb.blend_type = 'MULTIPLY'; cb.inputs['Factor'].default_value = 1.0
cb.inputs[7].default_value = (0.30, 0.46, 1.0, 1)
nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs[0], env.inputs['Vector'])
nt.links.new(env.outputs[0], hsv.inputs['Color']); nt.links.new(hsv.outputs[0], cb.inputs[6]); nt.links.new(cb.outputs[2], bg.inputs['Color'])
nt.links.new(bg.outputs[0], out.inputs['Surface'])
sc.view_settings.exposure = expo

# luz de luna muy suave para dar forma
sun = bpy.data.lights.new('luna', 'SUN'); sun.energy = 0.08; sun.color = (0.62, 0.72, 1.0); sun.angle = math.radians(2)
so = bpy.data.objects.new('luna', sun); so.rotation_euler = (math.radians(55), 0, math.radians(150)); sc.collection.objects.link(so)

# ---------------------------------------------------------------- cámara
cd = bpy.data.cameras.new('cam'); cd.lens = lente; cd.sensor_width = 36; cd.shift_y = shift
cd.clip_start = 0.05; cd.clip_end = 600
co = bpy.data.objects.new('cam', cd); sc.collection.objects.link(co); sc.camera = co
co.location = cam
d = Vector(obj) - Vector(cam)
co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
if GRIS:
    # misma cámara, la casa como se entrega hoy: obra gris (pañete, placas en concreto, sin acabados ni jardín)
    def panete(nombre, carpeta, tinte, periodo=2.0):
        m = bpy.data.materials.new(nombre); m.use_nodes = True; n = m.node_tree; b = n.nodes['Principled BSDF']
        tc_ = n.nodes.new('ShaderNodeTexCoord'); mp_ = n.nodes.new('ShaderNodeMapping'); mp_.inputs['Scale'].default_value = (1 / periodo,) * 3
        n.links.new(tc_.outputs['UV'], mp_.inputs['Vector'])
        d = f'{F}/ph/tex/{carpeta}/{carpeta}_'
        ci = n.nodes.new('ShaderNodeTexImage'); ci.image = bpy.data.images.load(d + 'Diffuse_2k.jpg'); n.links.new(mp_.outputs[0], ci.inputs[0])
        hs = n.nodes.new('ShaderNodeHueSaturation'); hs.inputs['Saturation'].default_value = 0.15; n.links.new(ci.outputs[0], hs.inputs['Color'])
        mx = n.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1; mx.inputs[7].default_value = (*tinte, 1)
        n.links.new(hs.outputs[0], mx.inputs[6]); n.links.new(mx.outputs[2], b.inputs['Base Color'])
        ni = n.nodes.new('ShaderNodeTexImage'); ni.image = bpy.data.images.load(d + 'nor_gl_2k.jpg'); ni.image.colorspace_settings.name = 'Non-Color'
        n.links.new(mp_.outputs[0], ni.inputs[0]); nm_ = n.nodes.new('ShaderNodeNormalMap'); nm_.inputs['Strength'].default_value = 1.0
        n.links.new(ni.outputs[0], nm_.inputs['Color']); n.links.new(nm_.outputs[0], b.inputs['Normal'])
        b.inputs['Roughness'].default_value = 0.92
        return m
    P = panete('panete', 'concrete_wall_008', (0.62, 0.62, 0.6), 2.2)
    Cn = panete('placa', 'concrete_floor_02', (0.55, 0.55, 0.53), 3.0)
    swap = {'estuco': P, 'estucoOsc': P, 'laja': P, 'yeso': P, 'maderaCielo': P, 'pisoMadera': Cn, 'porcelanato': Cn, 'grava': Cn}
    for nombre in ('casa', 'casa_vecina'):
        col = bpy.data.collections[nombre]
        for o in col.all_objects:
            if o.type == 'MESH' and o.active_material is not None:
                mn = o.active_material.name
                if mn in swap: o.material_slots[0].material = swap[mn]
                if mn in ('puerta', 'cortina', 'luzFoco', 'negro', 'tierra'): o.hide_render = True
            if o.type == 'MESH' and o.active_material is None: pass
            if o.parent and o.parent.name.endswith('_set'): o.hide_render = True
            if o.name.endswith('_set'): o.hide_render = True
            if o.type == 'LIGHT': o.data.energy = 0.0
        # bombillos de obra
        for (x, y, z) in ((3.0, 4.5, 2.3), (5.2, 11.0, 2.3), (3.0, 4.6, 5.1), (6.0, 11.0, 5.1)):
            ld_ = bpy.data.lights.new('bombillo', 'POINT'); ld_.energy = 18; ld_.color = (1.0, 0.6, 0.3); ld_.shadow_soft_size = 0.03
            ob_ = bpy.data.objects.new('bombillo', ld_); ob_.location = (x, y, z); col.objects.link(ob_)
    for o in bpy.data.objects:
        if o.users_collection and o.users_collection[0].name == 'plantas':
            if o.type == 'LIGHT' and not o.name.startswith('poste'): o.hide_render = True
            if o.type == 'MESH' and o.location.y < 14 and not o.name.startswith(('island_tree', 'tree_small', 'poste')): o.hide_render = True
        if o.name.startswith('cesped_') and o.name != 'cesped_fondo':
            for md in o.modifiers:
                if md.type == 'PARTICLE_SYSTEM': md.show_render = False
if toma == 'sala':
    # vista real del valle de Aburrá de noche (foto de Montana) detrás de la vidriera
    import bmesh
    VAL = os.environ['AXV_VISTA']  # foto real de la vista del proyecto (del cliente)
    for o in list(bpy.data.objects):
        if o.name in ('terreno', 'montanas'): o.hide_render = True
        if o.users_collection and o.users_collection[0].name == 'plantas' and o.type in ('MESH', 'LIGHT') and o.location.y > 15: o.hide_render = True
        if o.name == 'cesped_fondo':
            for v in o.data.vertices:
                if v.co.y > 20: v.co.y = 16.8
    cam_v = Vector(cam); dirv = (Vector(obj) - cam_v); dirv.z = 0; dirv.normalize()
    D = 75.0; Wp = 150.0; Hp = Wp / 1.6
    c = cam_v + dirv * D; c.z = 1.32 + Hp * 0.06
    me = bpy.data.meshes.new('valle'); bm = bmesh.new()
    right = Vector((dirv.y, -dirv.x, 0))
    vs = [bm.verts.new(c + right * sx * Wp / 2 + Vector((0, 0, sz * Hp / 2))) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = bm.faces.new(vs); uv = bm.loops.layers.uv.new('UVMap')
    for l, u in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): l[uv].uv = u
    bm.to_mesh(me); bm.free()
    pv = bpy.data.objects.new('valle', me); sc.collection.objects.link(pv)
    mv = bpy.data.materials.new('valle'); mv.use_nodes = True; nt2 = mv.node_tree; nt2.nodes.clear()
    o2 = nt2.nodes.new('ShaderNodeOutputMaterial'); em = nt2.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 0.9
    ti = nt2.nodes.new('ShaderNodeTexImage'); ti.image = bpy.data.images.load(VAL); ti.extension = 'EXTEND'
    nt2.links.new(ti.outputs[0], em.inputs['Color']); nt2.links.new(em.outputs[0], o2.inputs['Surface'])
    me.materials.append(mv)
    pv.visible_diffuse = False; pv.visible_shadow = False; pv.visible_volume_scatter = False
    # cerca viva al borde del lote (el terreno cae hacia el valle)
    veg = bpy.data.collections.get('veg_src')
    shr = [o for o in veg.objects if o.name.startswith('shrub_02')] if veg else []
    import random; random.seed(3)
    for i in range(18):
        s = random.choice(shr); n = bpy.data.objects.new('cerca', s.data); sc.collection.objects.link(n)
        n.location = (-2.0 + i * 0.8, 16.5 + random.uniform(-0.15, 0.15), -0.05); n.rotation_euler = (0, 0, random.uniform(0, 6.28)); n.scale = (0.9,) * 3
    bpy.context.view_layer.use_pass_mist = False
if toma in ANIM:
    c0, c1, t0, t1, _, nf, dof = ANIM[toma]
    tgt = bpy.data.objects.new('objetivo', None); sc.collection.objects.link(tgt)
    k = co.constraints.new('TRACK_TO'); k.target = tgt; k.track_axis = 'TRACK_NEGATIVE_Z'; k.up_axis = 'UP_Y'
    for f, c, tt in ((1, c0, t0), (nf, c1, t1)):
        co.location = c; co.keyframe_insert('location', frame=f)
        tgt.location = tt; tgt.keyframe_insert('location', frame=f)
    for ob in (co, tgt):
        for fc in ob.animation_data.action.fcurves:
            for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'; kp.easing = 'EASE_IN_OUT'
    sc.frame_start = 1; sc.frame_end = nf; sc.render.fps = 12
    sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.5
    sc.render.use_persistent_data = True
    cy.adaptive_threshold = 0.03; cy.diffuse_bounces = 2; cy.glossy_bounces = 2; cy.transparent_max_bounces = 16
    if dof:
        cd.dof.use_dof = True; cd.dof.focus_object = tgt; cd.dof.aperture_fstop = 4.0
        # el enfoque sigue a la piedra (objetivo a la altura de la cámara + un poco)
if toma == 'piedra':
    cd.dof.use_dof = True; cd.dof.focus_distance = (Vector(obj) - Vector(cam)).length * 0.8; cd.dof.aperture_fstop = 2.8

# ---------------------------------------------------------------- composición: brillo suave de las luces y lente
sc.use_nodes = True
ct = sc.node_tree; ct.nodes.clear()
rl = ct.nodes.new('CompositorNodeRLayers')
gl = ct.nodes.new('CompositorNodeGlare'); gl.glare_type = 'FOG_GLOW'; gl.quality = 'HIGH'
gl.inputs['Threshold'].default_value = 1.4; gl.inputs['Strength'].default_value = 0.22; gl.inputs['Size'].default_value = 0.55
ld = ct.nodes.new('CompositorNodeLensdist'); ld.inputs['Distortion'].default_value = -0.006; ld.inputs['Dispersion'].default_value = 0.008
comp = ct.nodes.new('CompositorNodeComposite')
# perspectiva atmosférica con el pase de niebla (mist)
bpy.context.view_layer.use_pass_mist = True
sc.world.mist_settings.start = 35; sc.world.mist_settings.depth = 650; sc.world.mist_settings.falloff = 'QUADRATIC'
haze = ct.nodes.new('CompositorNodeMixRGB'); haze.blend_type = 'MIX'
haze.inputs[2].default_value = (0.105, 0.135, 0.24, 1)
mr = ct.nodes.new('CompositorNodeMapRange'); mr.inputs['To Max'].default_value = 0.75; mr.use_clamp = True
if toma != 'sala':
    ct.links.new(rl.outputs['Mist'], mr.inputs['Value']); ct.links.new(mr.outputs[0], haze.inputs['Fac'])
else:
    haze.inputs['Fac'].default_value = 0.0
ct.links.new(rl.outputs['Image'], haze.inputs[1])
ct.links.new(haze.outputs[0], gl.inputs['Image'])
ct.links.new(gl.outputs['Image'], ld.inputs['Image'])
ct.links.new(ld.outputs['Image'], comp.inputs['Image'])

if toma in ANIM:
    if len(argv) > 6: sc.frame_start, sc.frame_end = int(argv[5]), int(argv[6])
    sc.render.filepath = OUT  # carpeta/prefijo
    bpy.ops.render.render(animation=True)
else:
    if len(argv) > 5: sc.frame_set(int(argv[5]))
    sc.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
print('LISTO', OUT)
