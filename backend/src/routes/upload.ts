// POST /api/upload
//   form-data: file (image/*)
//   giới hạn: 10 MB, chỉ nhận image/*

// → uploadFile() → storage-client.ts → MinIO/S3
// → trả { url } (public URL để FE hiển thị ảnh)





import { Hono } from 'hono';
import { uploadFile } from '../lib/storage-client.js';

const router = new Hono();

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** POST /api/upload — accepts a single image file, returns { url } */
router.post('/', async (c) => {
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Invalid multipart form data' }, 400);
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Missing "file" field' }, 400);
  }

  if (!file.type.startsWith('image/')) {
    return c.json({ error: 'Only image files are allowed' }, 400);
  }

  if (file.size > MAX_BYTES) {
    return c.json({ error: 'File too large — max 10 MB' }, 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadFile(buffer, file.name || 'upload', file.type);
    return c.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Upload] Storage error:', msg);
    return c.json({ error: 'Upload failed', detail: msg }, 502);
  }
});

export default router;
