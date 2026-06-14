// node scripts/generate-icons.js
// Generates extension icons from brand/logo/logo-icon-dark.png

const sharp  = require('sharp');
const path   = require('path');

const SRC  = path.join(__dirname, '..', 'brand', 'logo', 'logo-icon-dark.png');
const DEST = path.join(__dirname, '..', 'extension-chrome', 'icons');

const SIZES = [16, 48, 128];

(async () => {
  for (const size of SIZES) {
    await sharp(SRC)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(DEST, `icon${size}.png`));
    console.log(`✓ icon${size}.png`);
  }
  console.log('Icons generated in extension-chrome/icons/');
})();
