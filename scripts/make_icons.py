# Génère l'icône et l'écran de démarrage Android (aucune image externe)
from PIL import Image, ImageDraw, ImageFilter
import os, sys
RES = sys.argv[1]

def art(size, bg=True):
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg:
        for r in range(S // 2, 0, -4):
            k = r / (S / 2)
            c = int(18 + (1 - k) * 40)
            d.ellipse([S/2 - r, S/2 - r, S/2 + r, S/2 + r], fill=(c, c + 2, c + 6, 255))
    cx, cy = S * .5, S * .56
    u = S / 100
    # manteau
    d.polygon([(cx - 9*u, cy - 6*u), (cx + 9*u, cy - 6*u), (cx + 15*u, cy + 20*u), (cx - 15*u, cy + 20*u)], fill=(30, 30, 36, 255))
    # tête + bonnet + pompon
    d.ellipse([cx - 11*u, cy - 27*u, cx + 11*u, cy - 5*u], fill=(232, 214, 200, 255))
    d.chord([cx - 12*u, cy - 31*u, cx + 12*u, cy - 9*u], 180, 360, fill=(70, 72, 80, 255))
    d.ellipse([cx - 3.5*u, cy - 36*u, cx + 3.5*u, cy - 29*u], fill=(90, 92, 100, 255))
    d.ellipse([cx - 6*u, cy - 18*u, cx - 2.5*u, cy - 13*u], fill=(10, 10, 12, 255))
    d.ellipse([cx + 2.5*u, cy - 18*u, cx + 6*u, cy - 13*u], fill=(10, 10, 12, 255))
    # écharpe rouge qui flotte
    d.rounded_rectangle([cx - 10*u, cy - 7*u, cx + 10*u, cy - 2*u], radius=2*u, fill=(196, 34, 28, 255))
    d.polygon([(cx - 8*u, cy - 6*u), (cx - 26*u, cy - 12*u), (cx - 30*u, cy - 6*u), (cx - 8*u, cy - 2*u)], fill=(176, 28, 24, 255))
    glow = im.filter(ImageFilter.GaussianBlur(S / 60))
    out = Image.alpha_composite(glow, im)
    return out.resize((size, size), Image.LANCZOS)

dens = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for k, s in dens.items():
    p = os.path.join(RES, 'mipmap-' + k); os.makedirs(p, exist_ok=True)
    ic = art(s); ic.save(os.path.join(p, 'ic_launcher.png'))
    mask = Image.new('L', (s, s), 0); ImageDraw.Draw(mask).ellipse([0, 0, s, s], fill=255)
    r = Image.new('RGBA', (s, s), (0, 0, 0, 0)); r.paste(ic, (0, 0), mask); r.save(os.path.join(p, 'ic_launcher_round.png'))
    fg = Image.new('RGBA', (int(s * 2.25), int(s * 2.25)), (0, 0, 0, 0)); a = art(int(s * 1.5), bg=False); fg.paste(a, ((fg.width - a.width) // 2, (fg.height - a.height) // 2), a)
    fg.save(os.path.join(p, 'ic_launcher_foreground.png'))
# écrans de démarrage : noir avec l'enfant au centre
for folder in os.listdir(RES):
    if folder.startswith('drawable'):
        f = os.path.join(RES, folder, 'splash.png')
        if os.path.exists(f):
            w, h = Image.open(f).size
            sp = Image.new('RGBA', (w, h), (0, 0, 0, 255)); a = art(int(min(w, h) * .35), bg=False)
            sp.paste(a, ((w - a.width) // 2, (h - a.height) // 2), a); sp.convert('RGB').save(f)
print('icônes générées')
