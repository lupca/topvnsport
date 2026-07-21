import os
from PIL import Image
from pyzbar.pyzbar import decode

def read_qrs(folder):
    for f in os.listdir(folder):
        path = os.path.join(folder, f)
        if os.path.isfile(path):
            try:
                img = Image.open(path)
                decoded = decode(img)
                for d in decoded:
                    print(f"{f}: {d.data.decode('utf-8')} (Type: {d.type})")
                if not decoded:
                    print(f"{f}: No QR found")
            except Exception as e:
                print(f"Error reading {f}: {e}")

print('--- Orders ---')
read_qrs('/home/lupca/projects/topvnsport/QRcode/order')
print('--- Products ---')
read_qrs('/home/lupca/projects/topvnsport/QRcode/product')
