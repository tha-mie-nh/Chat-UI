/**
 * S3-compatible storage client (MinIO in dev, AWS S3 in prod).
 * To swap to real S3: set MINIO_ENDPOINT to your S3 endpoint,
 * remove forcePathStyle, update credentials. No code changes needed.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const endpoint = process.env.MINIO_ENDPOINT ?? 'localhost';
const port = Number(process.env.MINIO_PORT ?? 9000);
const accessKeyId = process.env.MINIO_ACCESS_KEY ?? 'minioadmin';
const secretAccessKey = process.env.MINIO_SECRET_KEY ?? 'minioadmin';
export const BUCKET = process.env.MINIO_BUCKET ?? 'chatbot-uploads';

// Public base URL used to build the returned file URL
// In prod with real S3, this would be your CDN or bucket URL
const publicBase = process.env.MINIO_PUBLIC_URL
  ?? `http://${endpoint}:${port}/${BUCKET}`;

const s3 = new S3Client({
  endpoint: `http://${endpoint}:${port}`,
  region: 'us-east-1', // required by SDK, ignored by MinIO
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true, // required for MinIO path-style URLs
});

/**
 * Upload a file buffer to storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  contentType: string
): Promise<string> {
  const ext = originalName.split('.').pop()?.toLowerCase() ?? 'bin';
  const key = `${randomUUID()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${publicBase}/${key}`;
}




// Dùng AWS SDK S3Client trỏ đến MinIO (dev) hoặc S3 thật (prod).
// uploadFile():
//   - Tạo key ngẫu nhiên: {UUID}.{ext}
//   - PutObject lên bucket
//   - Trả về publicBase/key (URL public để browser load ảnh)

// Swap sang S3 thật: đổi env vars, bỏ forcePathStyle
