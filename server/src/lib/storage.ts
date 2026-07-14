import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multerS3 from 'multer-s3';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

const s3Configured = !!(env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);

const s3 = new S3Client({
    region:   env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    credentials: {
        accessKeyId:     env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
    },
});

// folderOrFn: string prefix OR (file) => string for per-field routing
// allowedExts: array of lowercase extensions e.g. ['.jpg', '.pdf'], or null to skip ext check
export function makeUploader(
    folderOrFn: string | ((file: Express.Multer.File) => string),
    allowedExts: string[] | null,
    options: { maxSize?: number; fileFilter?: multer.Options['fileFilter'] } = {}
) {
    const storage: multer.StorageEngine = s3Configured
        ? multerS3({
            s3,
            bucket: env.S3_BUCKET,
            // Without this, multer-s3 stores every object as application/octet-stream —
            // images mostly still render (browsers sniff <img> content), but <audio>/
            // <video> refuse to play a resource served with the wrong Content-Type.
            contentType: multerS3.AUTO_CONTENT_TYPE,
            key: (req, file, cb) => {
                const ext = path.extname(file.originalname || '').toLowerCase();
                if (allowedExts && !allowedExts.includes(ext)) {
                    return cb(new Error('Invalid file type'));
                }
                const folder = typeof folderOrFn === 'function' ? folderOrFn(file) : folderOrFn;
                cb(null, `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
            },
        })
        : multer.diskStorage({
            destination: (req, file, cb) => {
                const folder = typeof folderOrFn === 'function' ? folderOrFn(file) : folderOrFn;
                const dest = path.join('uploads', folder);
                fs.mkdirSync(dest, { recursive: true });
                cb(null, dest);
            },
            filename: (_req, file, cb) => {
                const ext = path.extname(file.originalname || '').toLowerCase();
                cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
            },
        });

    return multer({
        storage,
        limits: { fileSize: options.maxSize ?? 50 * 1024 * 1024 },
        ...(options.fileFilter && { fileFilter: options.fileFilter }),
    });
}

export async function deleteFile(key: string | null | undefined): Promise<void> {
    if (!key) return;
    if (!s3Configured) {
        fs.unlink(key, () => {});
        return;
    }
    await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

export async function createSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn });
}

// Converts an S3 key to a public URL. In dev (no S3), returns a local /uploads path.
// Some fields (e.g. exercise thumbnail_path) can also hold an already-absolute URL —
// imported/seeded data, not something a coach uploaded — so pass those through as-is
// rather than prefixing them into a broken /uploads/https://... path.
export function toPublicUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    if (/^https?:\/\//.test(key)) return key;
    if (!s3Configured) return `/uploads/${key}`;
    const base = (env.S3_PUBLIC_URL || `${env.S3_ENDPOINT}/${env.S3_BUCKET}`).replace(/\/$/, '');
    return `${base}/${key}`;
}
