#!/usr/bin/env python3
"""
Image Optimization Script
=========================
Resizes high-res cutouts and original background photos so they load instantly
and scroll at 60/120fps without GPU memory bottlenecks.
Max dimension: 1920px (optimal for retina displays and 4K displays).
"""

from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ORIG_DIR = ROOT / "public" / "images" / "originals"
CUT_DIR = ROOT / "public" / "images" / "cutouts"

MAX_DIM = 1920

def optimize_originals():
    for f in ORIG_DIR.glob("*.jpg"):
        try:
            with Image.open(f) as img:
                img = ImageOps.exif_transpose(img)
                w, h = img.size
                if max(w, h) > MAX_DIM:
                    print(f"Resizing original {f.name} from {img.size}...")
                    img.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)
                    img.convert("RGB").save(f, "JPEG", quality=85, optimize=True, progressive=True)
                    print(f"  -> Done: new size {img.size}")
        except Exception as e:
            print(f"Error optimizing {f.name}: {e}")

def optimize_cutouts():
    for f in CUT_DIR.glob("*.png"):
        try:
            with Image.open(f) as img:
                w, h = img.size
                if max(w, h) > MAX_DIM:
                    print(f"Resizing cutout {f.name} from {img.size}...")
                    img.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)
                    img.save(f, "PNG", optimize=True)
                    print(f"  -> Done: new size {img.size}")
        except Exception as e:
            print(f"Error optimizing {f.name}: {e}")

if __name__ == "__main__":
    print("--- Optimizing Cutouts ---")
    optimize_cutouts()
    print("--- Optimizing Originals ---")
    optimize_originals()
    print("--- Optimization Complete ---")
