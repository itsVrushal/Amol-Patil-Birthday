#!/usr/bin/env python3
"""
Background Removal Script — Direct ONNX approach
=================================================
Bypasses rembg's pymatting/numba dependency chain (blocked by App Control).
Uses onnxruntime + the U2Net ONNX model directly.

Requirements (all working on this machine):
    pip install onnxruntime pillow tqdm requests numpy

Usage:
    python scripts/remove_bg.py           # process all slides from config.json
    python scripts/remove_bg.py --force   # re-process even existing cutouts

Models used:
    u2net_human_seg — best for portraits/people (auto-downloaded ~175 MB, once)
"""

import json, sys, os, hashlib, urllib.request, shutil
from pathlib import Path
import numpy as np

try:
    from PIL import Image, ImageOps
    import onnxruntime as ort
    from tqdm import tqdm
except ImportError as e:
    print(f"❌ Missing dependency: {e}")
    print("   Run: python -m pip install onnxruntime pillow tqdm numpy")
    sys.exit(1)

# ── Paths ──────────────────────────────────────────────────────────────────
ROOT     = Path(__file__).resolve().parent.parent
CONFIG   = ROOT / "config.json"
SRC_DIR  = ROOT / "img_Dir"
ORIG_OUT = ROOT / "public" / "images" / "originals"
CUT_OUT  = ROOT / "public" / "images" / "cutouts"
MODEL_DIR = Path.home() / ".u2net"

ORIG_OUT.mkdir(parents=True, exist_ok=True)
CUT_OUT.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# ── Model config ───────────────────────────────────────────────────────────
MODEL_URL  = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx"
MODEL_PATH = MODEL_DIR / "u2net_human_seg.onnx"
INPUT_SIZE = 320  # U2Net input resolution

# ── Download model if needed ───────────────────────────────────────────────
def download_model():
    if MODEL_PATH.exists():
        return
    print(f"📥 Downloading U2Net model (~175 MB) to {MODEL_PATH} ...")
    print("   This only happens once.\n")
    tmp = str(MODEL_PATH) + ".tmp"
    try:
        with urllib.request.urlopen(MODEL_URL) as resp, open(tmp, "wb") as f:
            total = int(resp.headers.get("Content-Length", 0))
            downloaded = 0
            block = 1024 * 64
            bar = tqdm(total=total, unit="B", unit_scale=True, desc="Downloading model")
            while True:
                chunk = resp.read(block)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                bar.update(len(chunk))
            bar.close()
        shutil.move(tmp, str(MODEL_PATH))
        print(f"✅ Model saved to {MODEL_PATH}\n")
    except Exception as e:
        if os.path.exists(tmp):
            os.remove(tmp)
        print(f"❌ Download failed: {e}")
        print("   Please download manually from:")
        print(f"   {MODEL_URL}")
        print(f"   and save to: {MODEL_PATH}")
        sys.exit(1)

# ── Pre/post processing ────────────────────────────────────────────────────
def preprocess(img: Image.Image) -> np.ndarray:
    """Resize, normalize, add batch dim → (1, 3, 320, 320)"""
    img = img.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / np.float32(255.0)
    # U2Net normalization — keep everything float32
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr  = (arr - mean) / std
    arr  = arr.transpose(2, 0, 1).astype(np.float32)  # HWC → CHW, ensure float32
    return arr[np.newaxis, :].astype(np.float32)       # add batch dim

def postprocess(pred: np.ndarray, orig_size: tuple) -> Image.Image:
    """Convert model output to a PIL mask at original resolution."""
    mask = pred.squeeze()           # (320, 320)
    # Normalize to 0-255
    mask = (mask - mask.min()) / (mask.max() - mask.min() + 1e-8)
    mask = (mask * 255).astype(np.uint8)
    mask_img = Image.fromarray(mask).resize(orig_size, Image.LANCZOS)
    return mask_img

def remove_background(src: Path, dest: Path, session: ort.InferenceSession):
    """Remove background from src image, save RGBA PNG to dest."""
    orig = Image.open(src)
    try:
        orig = ImageOps.exif_transpose(orig)
    except Exception:
        pass
    orig_rgb = orig.convert("RGB")
    w, h = orig_rgb.size

    inp = preprocess(orig_rgb)
    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: inp})
    mask = postprocess(outputs[0], (w, h))

    # Apply mask as alpha channel
    rgba = orig_rgb.convert("RGBA")
    rgba.putalpha(mask)
    rgba.save(str(dest), "PNG")

def copy_original(src: Path, dest_dir: Path, force: bool = False) -> Path:
    """Copy original as optimized JPEG."""
    stem = src.stem
    dest = dest_dir / (stem + ".jpg")
    if dest.exists() and not force:
        return dest
    img = Image.open(src)
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    img.convert("RGB").save(str(dest), "JPEG", quality=88, optimize=True, progressive=True)
    return dest

# ── Main ───────────────────────────────────────────────────────────────────
def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-process existing cutouts")
    args = parser.parse_args()

    with open(CONFIG, encoding="utf-8") as f:
        config = json.load(f)
    slides = config.get("slides", [])

    if not slides:
        print("❌ No slides in config.json"); sys.exit(1)

    # Download model if needed
    download_model()

    print(f"🤖 Loading ONNX session...")
    session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    print(f"✅ Model loaded\n")
    print(f"📸 Processing {len(slides)} images...\n")

    errors = []
    for slide in tqdm(slides, desc="Processing", unit="img"):
        bg_file     = slide.get("backgroundImage", "")
        cutout_file = slide.get("cutoutImage", "")
        src         = SRC_DIR / bg_file

        if not src.exists():
            tqdm.write(f"  ⚠️  Not found, skipping: {bg_file}")
            errors.append(bg_file)
            continue

        # 1. Copy original
        try:
            orig_dest = copy_original(src, ORIG_OUT, force=args.force)
            tqdm.write(f"  🖼️  Original → {orig_dest.name}")
        except Exception as e:
            tqdm.write(f"  ❌ Failed original {bg_file}: {e}")
            errors.append(bg_file); continue

        # 2. Remove background
        cutout_dest = CUT_OUT / cutout_file
        if cutout_dest.exists() and not args.force:
            tqdm.write(f"  ✂️  Cutout already exists, skipping (use --force to redo)")
            continue
        try:
            remove_background(src, cutout_dest, session)
            tqdm.write(f"  ✂️  Cutout   → {cutout_dest.name}")
        except Exception as e:
            tqdm.write(f"  ❌ BG removal failed {bg_file}: {e}")
            errors.append(bg_file)

    print("\n" + "─" * 50)
    ok = len(slides) - len(errors)
    print(f"✅ Done! {ok}/{len(slides)} images processed.")
    if errors:
        print(f"⚠️  Failed: {', '.join(errors)}")
    print(f"\nOriginals → {ORIG_OUT}")
    print(f"Cutouts   → {CUT_OUT}")
    print("\nNow run: npm run dev  (or it's already running at http://localhost:3000)")

if __name__ == "__main__":
    main()
