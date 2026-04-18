/**
 * Refines public/tatsat-mark.png from the original backup:
 * uniform center crop (zoom) → Lanczos3 resize → centered on #000 square with padding.
 * No new elements; same pixels, re-framed for favicon/nav safe zones.
 */
import sharp from "sharp";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "public", "tatsat-mark.png");
const backupPath = join(root, "public", "tatsat-mark-source-backup.png");

const OUT = 1024;
/** Center square crop: fraction of source side kept (smaller = more zoom on core). */
const CROP_FRAC = 0.73;
/** Black padding on final asset (fraction of OUT — helps masked favicons). */
const PAD_FRAC = 0.08;

async function main() {
  const inputPath = existsSync(backupPath) ? backupPath : outPath;
  const meta = await sharp(inputPath).metadata();
  const w = meta.width ?? OUT;
  const h = meta.height ?? OUT;
  const minSide = Math.min(w, h);
  const sqLeft = Math.floor((w - minSide) / 2);
  const sqTop = Math.floor((h - minSide) / 2);

  const square = await sharp(inputPath)
    .extract({ left: sqLeft, top: sqTop, width: minSide, height: minSide })
    .png()
    .toBuffer();

  const side = minSide;
  const cropSide = Math.round(side * CROP_FRAC);
  const left = Math.floor((side - cropSide) / 2);
  const top = Math.floor((side - cropSide) / 2);
  const pad = Math.round(OUT * PAD_FRAC);
  const inner = OUT - 2 * pad;

  const zoomed = await sharp(square)
    .extract({ left, top, width: cropSide, height: cropSide })
    .resize(inner, inner, {
      kernel: sharp.kernel.lanczos3,
      fit: "fill",
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  await sharp({
    create: {
      width: OUT,
      height: OUT,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([{ input: zoomed, left: pad, top: pad }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);

  const after = await sharp(outPath).metadata();
  console.log("OK", outPath, `${after.width}x${after.height}`, { cropSide, inner, pad });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
