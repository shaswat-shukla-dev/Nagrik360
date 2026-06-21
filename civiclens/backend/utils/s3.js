const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuid } = require('uuid');
const path = require('path');

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || 'ap-south-1';
// Optional: set S3_PUBLIC_BASE_URL if serving via CloudFront / custom domain,
// otherwise we fall back to the standard virtual-hosted-style S3 URL.
const PUBLIC_BASE_URL =
  process.env.S3_PUBLIC_BASE_URL || `https://${BUCKET}.s3.${REGION}.amazonaws.com`;

const s3 = new S3Client({
  region: REGION,
  // If S3_ENDPOINT is set, this also works against S3-compatible storage
  // (Cloudflare R2, Backblaze B2, MinIO, etc.) for cheaper/no-egress-fee storage.
  ...(process.env.S3_ENDPOINT
    ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
    : {}),
});

/**
 * Upload a single in-memory file (from multer.memoryStorage) to S3.
 * Returns the public URL to store in the DB.
 */
async function uploadBuffer(file, folder = 'uploads') {
  if (!file) return null;
  const ext = path.extname(file.originalname) || '.jpg';
  const key = `${folder}/${uuid()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return `${PUBLIC_BASE_URL}/${key}`;
}

/** Delete an object given its full public URL (best-effort, never throws). */
async function deleteByUrl(url) {
  if (!url) return;
  try {
    const key = url.replace(`${PUBLIC_BASE_URL}/`, '');
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error('S3 delete failed (non-fatal):', err.message);
  }
}

module.exports = { uploadBuffer, deleteByUrl };
