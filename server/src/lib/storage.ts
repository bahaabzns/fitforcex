import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multerS3 from 'multer-s3';
import multer from 'multer';
import path from 'path';
import { env } from '../config/env';

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
    return multer({
        storage: multerS3({
            s3,
            bucket: env.S3_BUCKET,
            key: (req, file, cb) => {
                const ext = path.extname(file.originalname || '').toLowerCase();
                if (allowedExts && !allowedExts.includes(ext)) {
                    return cb(new Error('Invalid file type'));
                }
                const folder = typeof folderOrFn === 'function' ? folderOrFn(file) : folderOrFn;
                cb(null, `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
            },
        }),
        limits: { fileSize: options.maxSize ?? 50 * 1024 * 1024 },
        ...(options.fileFilter && { fileFilter: options.fileFilter }),
    });
}

export async function deleteFile(key: string | null | undefined): Promise<void> {
    if (!key) return;
    await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

export async function createSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn });
}

// Converts an S3 key to a public URL. Requires S3_PUBLIC_URL or S3_ENDPOINT + S3_BUCKET in env.
export function toPublicUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    const base = (env.S3_PUBLIC_URL || `${env.S3_ENDPOINT}/${env.S3_BUCKET}`).replace(/\/$/, '');
    return `${base}/${key}`;
}
