import importlib.util
import sys
from pathlib import Path
import unittest
import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
source = Path(__file__).resolve().parents[1] / "tools/build-photo-shine.py"
spec = importlib.util.spec_from_file_location("photo_masks", source)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class LetterMasks(unittest.TestCase):
    def test_bright_and_dark_dense_letter_strokes_not_the_surrounding_background(self):
        for background, foreground in [(0, 255), (255, 0)]:
            image = Image.new("RGB", (100, 80), (background,) * 3)
            ImageDraw.Draw(image).rectangle((25, 15, 50, 60), fill=(foreground,) * 3)
            before = image.tobytes()
            mask = builder.letter_mask(image, [{"x":25,"y":15,"w":26,"h":46}], 1, 1)
            known_glyph = np.zeros((80, 100), dtype=bool)
            known_glyph[15:61, 25:51] = True
            self.assertGreater(np.count_nonzero(mask[known_glyph]), 50)
            self.assertEqual(np.count_nonzero(mask[~known_glyph]), 0)
            self.assertEqual(image.tobytes(), before)

    def test_no_detected_words_means_no_shine_even_with_contrasting_equipment_shapes(self):
        image = Image.new("RGB", (100, 80), "black")
        ImageDraw.Draw(image).rectangle((10, 10, 90, 65), outline="white", width=4)
        self.assertEqual(np.count_nonzero(builder.letter_mask(image, [], 1, 1)), 0)

    def test_uniform_background_does_not_become_text_from_a_false_ocr_box(self):
        image = Image.new("RGB", (100, 80), (110, 110, 110))
        self.assertEqual(np.count_nonzero(builder.letter_mask(image, [{"x":5,"y":5,"w":90,"h":70}], 1, 1)), 0)


if __name__ == "__main__":
    unittest.main()
