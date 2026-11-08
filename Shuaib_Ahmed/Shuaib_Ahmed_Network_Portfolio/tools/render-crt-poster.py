"""Render the CRT portrait's still frame to assets/img/crt-portrait.webp.

The poster is what visitors see before the canvas starts and when it cannot run.
Needs Playwright and a local Chrome: py tools/render-crt-poster.py
"""
from pathlib import Path
import base64
import io
import json

from PIL import Image
from playwright.sync_api import sync_playwright

SITE = Path(__file__).resolve().parents[1]
OUT = SITE / "assets" / "img" / "crt-portrait.webp"
SIZE = (360, 450)  # CSS pixels; rendered at 2x


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2, reduced_motion="reduce")
        page.goto((SITE / "index.html").as_uri(), wait_until="load")
        page.evaluate("() => window.crtPortrait.setMotion('off')")
        page.add_style_tag(content=f".crt-screen {{ width: {SIZE[0]}px; height: {SIZE[1]}px; aspect-ratio: auto; }}")
        page.wait_for_function(
            "([w, h]) => { const c = document.querySelector('[data-crt-canvas]'); return c.dataset.crt === 'still' && c.width === w && c.height === h; }",
            arg=[SIZE[0] * 2, SIZE[1] * 2])
        # snapshot() draws and reads back in one task; a WebGL buffer is not kept after compositing.
        url = page.evaluate("() => window.crtPortrait.snapshot('image/png')")
        browser.close()
    image = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGB")
    image.save(OUT, "WEBP", quality=86, method=6)
    print(json.dumps({"size": image.size, "bytes": OUT.stat().st_size}))


if __name__ == "__main__":
    main()
