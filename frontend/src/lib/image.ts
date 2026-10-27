/** Shrinks big phone photos before upload (faster, cheaper, and under the server's 5 MB cap). */

const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];
const KEEP_AS_IS_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 1800;

export class UnsupportedImageError extends Error {}

export async function prepareBillImage(file: File): Promise<Blob> {
  if (OK_TYPES.includes(file.type) && file.size <= KEEP_AS_IS_BYTES) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UnsupportedImageError("Unsupported image. Please use a JPG, PNG or WebP photo.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UnsupportedImageError("Could not process this image in your browser.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new UnsupportedImageError("Could not process this image in your browser.");
  return blob;
}
