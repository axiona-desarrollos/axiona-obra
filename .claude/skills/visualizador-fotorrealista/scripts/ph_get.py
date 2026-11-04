import json, os, sys, urllib.request, hashlib
o=urllib.request.build_opener(); o.addheaders=[("User-Agent","Mozilla/5.0 (X11; Linux x86_64)")]; urllib.request.install_opener(o)
API="https://api.polyhaven.com/files/"
def get(url, dest):
    if os.path.exists(dest): return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    urllib.request.urlretrieve(url, dest)
def files(a):
    return json.load(urllib.request.urlopen(API+a))
kind, res, names = sys.argv[1], sys.argv[2], sys.argv[3:]
for n in names:
    try:
        f = files(n)
        if kind == "hdri":
            u = f["hdri"][res]["hdr"]["url"]; get(u, f"ph/hdri/{n}_{res}.hdr")
        elif kind == "model":
            b = f["blend"][res]["blend"]; d=f"ph/models/{n}"
            get(b["url"], f"{d}/{n}_{res}.blend")
            for rel, inf in b.get("include", {}).items(): get(inf["url"], f"{d}/{rel}")
        elif kind == "tex":
            d=f"ph/tex/{n}"
            for m, key in [("Diffuse","jpg"),("nor_gl","jpg"),("Rough","jpg"),("Displacement","jpg"),("AO","jpg")]:
                if m in f and res in f[m]:
                    fmt = f[m][res].get("jpg") or f[m][res].get("png")
                    get(fmt["url"], f"{d}/{n}_{m}_{res}.jpg")
        print("ok", n, flush=True)
    except Exception as e:
        print("FAIL", n, e, flush=True)
