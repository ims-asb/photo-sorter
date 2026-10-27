# Makes 14 test photos for grouping_chromium.js: two bursts of 4 near-identical shots (different sharpness, one second apart),
# a burst of 3, and single shots. Run from the folder where the photos should go.
from PIL import Image, ImageDraw, ImageFilter
import random, os
W,H=3000,2000
def background(seed):
    r=random.Random(seed); im=Image.new('RGB',(W,H),(r.randint(80,180),)*3); d=ImageDraw.Draw(im)
    for _ in range(220):
        x,y=r.randint(0,W-100),r.randint(0,H-100); d.rectangle([x,y,x+r.randint(30,260),y+r.randint(30,200)],fill=tuple(r.randint(0,255) for _ in range(3)))
    return im
def shot(seed,k,blur):
    im=background(seed).copy(); d=ImageDraw.Draw(im); x=600+k*90; d.rectangle([x,800,x+260,1500],fill=(250,30,30)); d.ellipse([x+60,640,x+200,800],fill=(240,200,160))
    return im.filter(ImageFilter.GaussianBlur(blur)) if blur else im
base=1_700_000_000
def save(name,im,t): im.save(name,quality=88); os.utime(name,(t,t))
save('IMG_00_single.jpg',background(900),base)
t=base+60
blurs=[1.5,3,0,1]
for b,seed in enumerate([11,12],start=1):
    for k in range(4): save(f'IMG_B{b}_{k+1}.jpg',shot(seed,k,blurs[k]),t+k)
    t+=60
    save(f'IMG_S{b}_single.jpg',background(800+b),t); t+=60
for k in range(3): save(f'IMG_B3_{k+1}.jpg',shot(13,k,[0,2,4][k]),t+k)
