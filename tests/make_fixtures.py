# Builds synthetic fixtures (fake CR2 files and a zip) into ./fx. Needs Pillow.
import io, os, random, struct, zipfile
from PIL import Image
os.makedirs('fx', exist_ok=True)

def jpeg(w, h, q, seed):
    im = Image.new('RGB', (w, h)); px = im.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = ((x*3+y) % 256, (y*2+x//2) % 256, (x+y+seed) % 256)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q); return b.getvalue()

P = jpeg(1400, 1000, 85, 1)   # full-size preview
T = jpeg(160, 120, 70, 2)     # thumbnail
open('fx/preview.jpg', 'wb').write(P)

def lossless_blob(n=40000):
    # decoy: a lossless JPEG (SOF3) like the real RAW payload; the app must ignore it
    r = random.Random(3)
    body = bytes(r.randrange(0, 0xF0) for _ in range(n))
    sof3 = b'\xFF\xC3' + struct.pack('>H', 17) + b'\x10' + struct.pack('>HH', 6000, 4000) + b'\x03\x01\x11\x00\x02\x11\x00\x03\x11\x00'
    sos = b'\xFF\xDA' + struct.pack('>H', 8) + b'\x03\x01\x00\x02\x00\x03'
    return b'\xFF\xD8' + sof3 + sos + body + b'\xFF\xD9'

def cr2(orientation, preview_at=20000, with_preview=True):
    hdr = b'II*\x00' + struct.pack('<I', 16) + b'CR\x02\x00' + struct.pack('<I', 0)
    ifd = (struct.pack('<H', 3) + struct.pack('<HHII', 0x100, 4, 1, 6000) + struct.pack('<HHII', 0x101, 4, 1, 4000)
           + struct.pack('<HHIHH', 0x112, 3, 1, orientation, 0) + struct.pack('<I', 0))
    data = bytearray(hdr + ifd)
    data += b'\x00' * (4096 - len(data)); data += T
    if with_preview:
        data += b'\x00' * (preview_at - len(data)); data += P
    data += b'\x00' * 64 + lossless_blob()
    return bytes(data)

open('fx/portrait.cr2', 'wb').write(cr2(6))
open('fx/landscape.cr2', 'wb').write(cr2(1))
open('fx/late.cr2', 'wb').write(cr2(1, preview_at=13 * 1024 * 1024))  # preview beyond the first 12 MB
open('fx/nopreview.cr2', 'wb').write(cr2(1, with_preview=False))       # thumbnail only

def zi(name, dt, ct):
    z = zipfile.ZipInfo(name, date_time=dt); z.compress_type = ct; return z
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w') as zf:
    D, S = zipfile.ZIP_DEFLATED, zipfile.ZIP_STORED
    zf.writestr(zi('day1/IMG_0001.JPG', (2026,10,1,10,0,0), D), b'jpgdata-day1-0001-' * 800)
    zf.writestr(zi('day1/IMG_0002.JPG', (2026,10,1,10,0,10), S), b'stored-day1-0002')
    zf.writestr(zi('day1/IMG_0001.CR2', (2026,10,1,10,0,0), D), cr2(1))   # RAW twin of IMG_0001.JPG, skipped
    zf.writestr(zi('day1/IMG_0003.CR2', (2026,10,1,10,0,20), D), cr2(6))  # portrait RAW, no twin
    zf.writestr(zi('day2/IMG_0001.JPG', (2026,10,1,11,0,0), D), b'jpgdata-day2-0001-' * 700)
    zf.writestr(zi('pic.webp', (2026,10,1,12,0,0), D), b'webp-bytes-' * 50)
    zf.writestr(zi('__MACOSX/day1/._IMG_0001.JPG', (2026,10,1,10,0,0), S), b'junk')
    zf.writestr(zi('notes.txt', (2026,10,1,10,0,0), S), b'hello')
    zf.writestr(zi('nested.zip', (2026,10,1,10,0,0), S), b'PK\x05\x06' + b'\x00' * 18)
open('fx/shoot.zip', 'wb').write(buf.getvalue())
open('fx/broken.zip', 'wb').write(b'this is not a zip at all')
print('fixtures written to ./fx')
