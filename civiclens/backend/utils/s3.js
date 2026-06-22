/**
 * Cloudinary — photo upload utility for Nagrik360.
 *
 * Why Cloudinary?
 *   - Free tier: 25GB storage + 25GB bandwidth/month
 *   - No credit card required — just email signup
 *   - Photos are auto-optimised and served via CDN globally
 *   - Dead simple API: upload a buffer, get a URL back
 *
 * Sign up free at: https://cloudinary.com/users/register_free
 * Your credentials are on the dashboard home page immediately after signup.
 */

const cloudinary = require('cloudinary').v2;

// ---- Configure Cloudinary from environment variables ----
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // always use https URLs
});

// ---- Validate at startup — clear warnings instead of cryptic errors later ----
const problems = [];
if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your_cloud_name')
  problems.push('CLOUDINARY_CLOUD_NAME is missing or still a placeholder');
if (!process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY === 'your_api_key')
  problems.push('CLOUDINARY_API_KEY is missing or still a placeholder');
if (!process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET === 'your_api_secret')
  problems.push('CLOUDINARY_API_SECRET is missing or still a placeholder');

const isCloudinaryConfigured = problems.length === 0;

if (!isCloudinaryConfigured) {
  console.warn('\n⚠️  Cloudinary is not fully configured. Photo uploads will be skipped.');
  problems.forEach(p => console.warn(`   → ${p}`));
  console.warn('   Sign up free at https://cloudinary.com/users/register_free');
  console.warn('   Then copy Cloud Name, API Key, API Secret from your dashboard.\n');
}

/**
 * Upload a photo (from multer.memoryStorage) to Cloudinary.
 * Returns the permanent public URL to store in the database.
 *
 * @param {Express.Multer.File} file   - multer file object (.buffer, .mimetype, .originalname)
 * @param {string} folder              - Cloudinary folder, e.g. "nagrik360/reports"
 * @returns {Promise<string|null>}     - secure CDN URL, e.g. https://res.cloudinary.com/...
 */
async function uploadToCloudinary(file, folder = 'nagrik360/reports') {
  if (!file) return null;
  if (!isCloudinaryConfigured) {
    console.warn(`[uploadToCloudinary] Skipping upload — Cloudinary is not configured (folder: ${folder})`);
    return null;
  }

  // Cloudinary accepts a stream or base64 data URI.
  // We wrap the buffer in a Promise using the upload_stream API.
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        // Auto-optimise quality and format for web delivery
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(error);
        // secure_url is always https
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}

/**
 * Delete a photo from Cloudinary by its URL.
 * Non-throwing — a failed delete is logged but never crashes the request.
 *
 * @param {string} publicUrl - the URL previously returned by uploadToCloudinary
 */
async function deleteFromCloudinary(publicUrl) {
  if (!publicUrl) return;
  try {
    // Derive the public_id from the URL.
    // Cloudinary URLs look like: https://res.cloudinary.com/<cloud>/image/upload/v123/<folder>/<id>.ext
    // The public_id is everything after "/upload/v<version>/" and without the file extension.
    const match = publicUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) return;
    const publicId = match[1];
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete failed (non-fatal):', err.message);
  }
}

module.exports = { uploadToCloudinary, deleteFromCloudinary };
