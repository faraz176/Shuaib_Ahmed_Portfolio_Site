"""Generate separate letter-alpha masks. Never modify source photos or export OCR text."""
from pathlib import Path
import argparse
import hashlib
import json
import math
import re
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageFilter

SITE = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def letter_mask(image, boxes, scale_x, scale_y):
    gray_image = image.convert("L")
    gray = np.asarray(gray_image, dtype=np.int16)
    local = np.asarray(gray_image.filter(ImageFilter.GaussianBlur(2)), dtype=np.int16)
    contrast = np.clip((np.abs(gray - local) - 7) * 6, 0, 255).astype(np.uint8)
    alpha = np.zeros(gray.shape, dtype=np.uint8)
    height, width = gray.shape
    for box in boxes:
        x0 = max(0, math.floor(box["x"] * scale_x) - 1)
        y0 = max(0, math.floor(box["y"] * scale_y) - 1)
        x1 = min(width, math.ceil((box["x"] + box["w"]) * scale_x) + 1)
        y1 = min(height, math.ceil((box["y"] + box["h"]) * scale_y) + 1)
        if x1 <= x0 or y1 <= y0:
            continue
        crop = gray[y0:y1, x0:x1]
        outer = gray[max(0, y0-2):min(height, y1+2), max(0, x0-2):min(width, x1+2)]
        border = np.concatenate((outer[0], outer[-1], outer[:, 0], outer[:, -1]))
        histogram = np.bincount(border // 8, minlength=32)
        background = int(np.argmax(histogram)) * 8 + 4
        ink = np.clip((np.abs(crop - background) - 16) * 4, 0, 255).astype(np.uint8)
        glyph = np.minimum(ink, contrast[y0:y1, x0:x1])
        alpha[y0:y1, x0:x1] = np.maximum(alpha[y0:y1, x0:x1], glyph)
    return alpha


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--work-dir", type=Path, help="Local geometry cache, outside the public site")
    args = parser.parse_args()
    work = (args.work_dir or Path(tempfile.mkdtemp(prefix="portfolio-shine-"))).resolve()
    if work.is_relative_to(SITE):
        raise ValueError("Keep temporary OCR inputs and geometry outside the public site.")
    work.mkdir(parents=True, exist_ok=True)
    inputs = work / "inputs"
    inputs.mkdir(exist_ok=True)
    registry = (SITE / "assets/js/archive-data.js").read_text(encoding="utf-8")
    photos = json.loads(registry.split("=", 1)[1].strip().removesuffix(";"))
    assert len({p["id"] for p in photos}) == len(photos)
    before = {}
    manifest = []
    for photo in photos:
        assert re.fullmatch(r"[A-Za-z0-9_-]+", photo["id"])
        source = (SITE / photo["src"]).resolve()
        assert source.is_relative_to(SITE / "assets")
        before[photo["id"]] = digest(source)
        with Image.open(source) as original:
            image = original.convert("RGB")
        width, height = image.size
        image.thumbnail((2200, 2200), Image.Resampling.LANCZOS)
        target = inputs / (photo["id"] + ".png")
        manifest.append({"id": photo["id"], "path": str(target), "src": photo["src"],
                         "width": width, "height": height, "ocrWidth": image.width,
                         "ocrHeight": image.height, "sha256": before[photo["id"]]})
        if not target.exists():
            image.save(target)
    manifest_file, boxes_file = work / "manifest.json", work / "boxes.json"
    reuse = manifest_file.exists() and boxes_file.exists() and json.loads(manifest_file.read_text()) == manifest
    manifest_file.write_text(json.dumps(manifest), encoding="utf-8")
    if not reuse:
        for item in manifest:
            with Image.open(SITE / item["src"]) as original:
                image = original.convert("RGB")
                image.thumbnail((2200, 2200), Image.Resampling.LANCZOS)
                image.save(item["path"])
        subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-File",
                        str(SITE / "tools/detect-photo-text.ps1"), "-Manifest", str(manifest_file),
                        "-Out", str(boxes_file)], check=True)
    detected = {item["id"]: item["boxes"] for item in json.loads(boxes_file.read_text(encoding="utf-8-sig"))}
    assert set(detected) == set(before)
    target_dir = SITE / "assets/archive/shine"
    target_dir.mkdir(exist_ok=True)
    index, coverage = {}, {}
    for item in manifest:
        with Image.open(SITE / item["src"]) as source:
            alpha = letter_mask(source, detected[item["id"]],
                                item["width"] / item["ocrWidth"], item["height"] / item["ocrHeight"])
        pixels = int(np.count_nonzero(alpha > 16))
        coverage[item["id"]] = {"boxes": len(detected[item["id"]]), "pixels": pixels}
        if pixels < 8:
            continue
        mask = Image.merge("LA", (Image.new("L", (item["width"], item["height"]), 255), Image.fromarray(alpha)))
        name = item["id"] + ".png"
        mask.save(target_dir / name, optimize=True)
        index[item["id"]] = "assets/archive/shine/" + name
    for photo in photos:
        assert digest(SITE / photo["src"]) == before[photo["id"]], "A source photo changed."
    (SITE / "assets/js/photo-shine-data.js").write_text(
        "// Generated letter-alpha masks. No recognized text is stored here.\nwindow.PORTFOLIO_SHINE = "
        + json.dumps(index, indent=2, sort_keys=True) + ";\n", encoding="utf-8")
    report = {"sources": len(photos), "withText": len(index), "withoutDetectedText": len(photos) - len(index),
              "maskBytes": sum((SITE / p).stat().st_size for p in index.values()),
              "sourceHashesUnchanged": True, "coverage": coverage}
    (work / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "coverage"}), flush=True)
    print("Local geometry cache:", work, flush=True)


if __name__ == "__main__":
    main()
