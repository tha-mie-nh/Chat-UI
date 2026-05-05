/**
 * Local file storage — lưu ảnh vào disk, serve qua BE static endpoint.
 * Swap sang S3: thay uploadFile() bằng S3Client, giữ nguyên interface.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'crypto';

export const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads';
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

/**
 * Lưu buffer vào UPLOADS_DIR/{YYYY-MM-DD}/{uuid}.{ext}
 * Trả về public URL để FE load ảnh qua BE static endpoint.
 */
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  contentType: string
): Promise<string> {
  void contentType; // không cần set content-type khi ghi file
  const ext = originalName.split('.').pop()?.toLowerCase() ?? 'bin';
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `${randomUUID()}.${ext}`;
  const dir = join(UPLOADS_DIR, date);

  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);

  return `${PUBLIC_BASE_URL}/uploads/${date}/${filename}`;
}
