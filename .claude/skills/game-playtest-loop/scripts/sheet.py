# Usage: python3 sheet.py out.png cols width img1 img2 ...
import sys
from PIL import Image, ImageDraw
out, cols, width = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
paths = sys.argv[4:]
imgs = [Image.open(p).convert('RGB') for p in paths]
tw = width // cols
th = int(tw * imgs[0].height / imgs[0].width)
rows = (len(imgs) + cols - 1) // cols
sheet = Image.new('RGB', (tw * cols, th * rows), (255, 255, 255))
d = ImageDraw.Draw(sheet)
for i, (im, p) in enumerate(zip(imgs, paths)):
    im = im.resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im, (x, y))
    d.rectangle([x, y, x + tw - 1, y + th - 1], outline=(42, 30, 79), width=2)
    d.text((x + 6, y + 4), p.split('/')[-1][:30], fill=(42, 30, 79))
sheet.save(out)
