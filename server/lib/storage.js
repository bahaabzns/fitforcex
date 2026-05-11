const { S3Client, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multerS3 = require('multer-s3');
const multer   = require('multer');
const path     = require('path');

const s3 = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId:     process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
    },
});

// folderOrFn: string prefix OR (file) => string for per-field routing
// allowedExts: array of lowercase extensions e.g. ['.jpg', '.pdf'], or null to skip ext check
// options.maxSize: bytes (default 50 MB)
// options.fileFilter: standard multer fileFilter fn
function makeUploader(folderOrFn, allowedExts, options = {}) {
    return multer({
        storage: multerS3({
            s3,
            bucket: process.env.S3_BUCKET,
            key: (req, file, cb) => {
                const ext = path.extname(file.originalname || '').toLowerCase();
                if (allowedExts && !allowedExts.includes(ext)) return cb(new Error('Invalid file type'));
                const folder = typeof folderOrFn === 'function' ? folderOrFn(file) : folderOrFn;
                cb(null, `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
            },
        }),
        limits: { fileSize: options.maxSize || 50 * 1024 * 1024 },
        ...(options.fileFilter && { fileFilter: options.fileFilter }),
    });
}

async function deleteFile(key) {
    if (!key) return;
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}

// Returns a time-limited signed URL for a private S3 object (default 1 hour).
async function createSignedUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn });
}

// Converts an S3 key to a public URL. Requires S3_PUBLIC_URL or S3_ENDPOINT + S3_BUCKET in env.
function toPublicUrl(key) {
    if (!key) return null;
    const base = (process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`).replace(/\/$/, '');
    return `${base}/${key}`;
}

module.exports = { makeUploader, deleteFile, createSignedUrl, toPublicUrl };
