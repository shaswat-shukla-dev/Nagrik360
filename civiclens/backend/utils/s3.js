/**
 * Cloudflare R2 — photo upload utility for Nagrik360.
 *
 * R2 is S3-API-compatible, so we use the standard @aws-sdk/client-s3 package.
 * The key difference from AWS S3:
 *   - AWS_REGION must be "auto"
 *   - An explicit endpoint URL is required (your account's R2 endpoint)
 *   - Public read URLs come from R2's r2.dev domain (or your custom domain),
 *     NOT from the standard s3.amazonaws.com pattern.
 *
 * All R2 config lives in env vars prefixed with R2_ — clearly separate from
 * any AWS-specific config you might have elsewhere.
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuid } = require('uuid');
const path = require('path');

// ---- Read R2 config from environment ----
const R2_BUCKET     = process.env.R2_BUCKET;
const R2_ENDPOINT   = process.env.R2_ENDPOINT;   // https://<ACCOUNT_ID>.r2.cloudflarestorage.com
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;  // https://pub-xxxx.r2.dev (or custom domain)
const R2_REGION     = process.env.R2_REGION || 'auto'; // must always be "auto" for R2

// ---- Validate at startup so you get a clear message, not a cryptic auth error ----
const problems = [];
if (!R2_BUCKET)   problems.push('R2_BUCKET is not set');
if (!R2_ENDPOINT) problems.push('R2_ENDPOINT is not set');
if (!R2_PUBLIC_URL) problems.push('R2_PUBLIC_URL is not set (needed to build public photo URLs)');
if (!process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID === 'your_r2_access_key_id')
  problems.push('R2_ACCESS_KEY_ID is missing or still a placeholder');
if (!process.env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY === 'your_r2_secret_access_key')
  problems.push('R2_SECRET_ACCESS_KEY is missing or still a placeholder');

if (problems.length > 0) {
  console.warn('\n⚠️  Cloudflare R2 is not fully configured. Photo uploads will fail.');
  problems.forEach(p => console.warn(`   → ${p}`));
  console.warn('   See .env.example for setup instructions.\n');
}

// ---- R2 client ----
// forcePathStyle: true is required for R2 (and most S3-compatible services).
const r2 = new S3Client({
  region: R2_REGION,
  endpoint: R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

/**
 * Upload a photo (from multer.memoryStorage) directly to R2.
 * Returns the permanent public URL to store in the database.
 *
 * @param {Express.Multer.File} file  - multer file object (has .buffer, .mimetype, .originalname)
 * @param {string} folder             - subfolder inside the bucket, e.g. "reports" or "reports/verification"
 * @returns {Promise<string|null>}    - public URL, e.g. https://pub-xxx.r2.dev/reports/uuid.jpg
 */
async function uploadToR2(file, folder = 'reports') {
  if (!file) return null;

  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const key = `${folder}/${uuid()}${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  // Public URL = R2_PUBLIC_URL + / + key
  return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}

/**
 * Delete a photo from R2 by its public URL.
 * Non-throwing — a failed delete is logged but never crashes the request.
 *
 * @param {string} publicUrl - the URL previously returned by uploadToR2
 */
async function deleteFromR2(publicUrl) {
  if (!publicUrl) return;
  try {
    // Derive the object key by stripping the bucket's public base URL.
    const base = R2_PUBLIC_URL.replace(/\/$/, '');
    const key = publicUrl.startsWith(base) ? publicUrl.slice(base.length + 1) : null;
    if (!key) return; // URL doesn't belong to our bucket — skip silently

    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (err) {
    console.error('R2 delete failed (non-fatal):', err.message);
  }
}

module.exports = { uploadToR2, deleteFromR2 };
