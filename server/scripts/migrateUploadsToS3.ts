/**
 * One-time script: upload all local files from server/uploads/ to S3.
 *
 * Run once against production before switching STORAGE_MODE to S3.
 * Uploads each file under the 'legacy/' prefix, preserving relative paths.
 *
 * Usage:
 *   S3_BUCKET=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_REGION=... \
 *   npx ts-node scripts/migrateUploadsToS3.ts
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const s3 = new S3Client({
    region:   process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
        accessKeyId:     process.env.S3_ACCESS_KEY ?? '',
        secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
});

const BUCKET = process.env.S3_BUCKET ?? '';

if (!BUCKET) {
    console.error('S3_BUCKET env var is required');
    process.exit(1);
}

async function uploadFile(localPath: string, s3Key: string): Promise<string> {
    const stream = fs.createReadStream(localPath);
    const upload = new Upload({
        client: s3,
        params: { Bucket: BUCKET, Key: s3Key, Body: stream },
    });
    await upload.done();
    return s3Key;
}

async function walk(dir: string, prefix: string): Promise<void> {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const s3Key   = `${prefix}/${entry.name}`;
        if (entry.isDirectory()) {
            await walk(fullPath, s3Key);
        } else {
            await uploadFile(fullPath, s3Key);
            console.log(`Uploaded: ${s3Key}`);
        }
    }
}

walk(UPLOADS_DIR, 'legacy').then(() => {
    console.log('Migration complete.');
}).catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
