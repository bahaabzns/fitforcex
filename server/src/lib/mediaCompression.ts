import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string | null = require('ffmpeg-static');

const execFileAsync = promisify(execFile);

export const MEDIA_TARGET_BYTES = 5 * 1024 * 1024;

// Progressively harsher passes — the first one that lands under the target wins,
// so small overshoots keep as much quality as possible.
const IMAGE_WIDTH_STEPS = [1080, 800, 640, 480, 360];
const IMAGE_QUALITY_STEPS = [82, 72, 62, 50];
const VIDEO_STEPS = [
    { height: 720, crf: 28 },
    { height: 540, crf: 30 },
    { height: 480, crf: 33 },
    { height: 360, crf: 36 },
];
const FFMPEG_TIMEOUT_MS = 2 * 60 * 1000;

export interface CompressedMedia {
    buffer: Buffer;
    mimetype: string;
    ext: string;
}

// Animated GIF -> animated WebP. Frame dimensions dominate size and every
// attempt re-decodes all frames (slow), so the first width is estimated from the
// size ratio and only a few shrinking retries are made.
// Long GIFs decode to a very tall frame strip that trips sharp's default pixel cap.
const GIF_INPUT_PIXEL_LIMIT = 1_000_000_000;
const GIF_MIN_WIDTH = 320;
const GIF_MAX_WIDTH = 720;
const GIF_MAX_ATTEMPTS = 4;
const GIF_SHRINK_FACTOR = 0.75;

async function compressGif(input: Buffer): Promise<CompressedMedia | null> {
    const { width: originalWidth = GIF_MAX_WIDTH } = await sharp(input, { animated: true, limitInputPixels: GIF_INPUT_PIXEL_LIMIT }).metadata();
    const sizeRatio = MEDIA_TARGET_BYTES / input.length;
    let width = Math.round(Math.min(GIF_MAX_WIDTH, Math.max(GIF_MIN_WIDTH, originalWidth * Math.sqrt(sizeRatio))));

    for (let attempt = 0; attempt < GIF_MAX_ATTEMPTS; attempt++) {
        const output = await sharp(input, { animated: true, limitInputPixels: GIF_INPUT_PIXEL_LIMIT })
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 65, effort: 2 })
            .toBuffer();
        if (output.length <= MEDIA_TARGET_BYTES) return { buffer: output, mimetype: 'image/webp', ext: '.webp' };
        width = Math.max(GIF_MIN_WIDTH, Math.round(width * GIF_SHRINK_FACTOR));
    }
    return null;
}

// Static images -> JPEG quality ladder.
export async function compressImage(input: Buffer, mimetype: string): Promise<CompressedMedia | null> {
    if (mimetype === 'image/gif') return compressGif(input);

    const steps = IMAGE_WIDTH_STEPS.flatMap((width) => IMAGE_QUALITY_STEPS.map((quality) => ({ width, quality })));
    for (const { width, quality } of steps) {
        const output = await sharp(input).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
        if (output.length <= MEDIA_TARGET_BYTES) return { buffer: output, mimetype: 'image/jpeg', ext: '.jpg' };
    }
    return null;
}

// Re-encodes to H.264/AAC MP4 (plays everywhere, incl. iOS), stepping down
// resolution + quality until the file fits.
export async function compressVideo(input: Buffer, originalExt: string): Promise<CompressedMedia | null> {
    if (!ffmpegPath) throw new Error('ffmpeg binary not available');

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ff-video-'));
    const inputPath = path.join(workDir, `in${originalExt || '.mp4'}`);
    const outputPath = path.join(workDir, 'out.mp4');
    try {
        await fs.writeFile(inputPath, input);
        for (const { height, crf } of VIDEO_STEPS) {
            await execFileAsync(ffmpegPath, [
                '-y', '-i', inputPath,
                '-vf', `scale=-2:'min(${height},ih)'`,
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf),
                '-c:a', 'aac', '-b:a', '96k',
                '-movflags', '+faststart',
                outputPath,
            ], { timeout: FFMPEG_TIMEOUT_MS });
            const { size } = await fs.stat(outputPath);
            if (size <= MEDIA_TARGET_BYTES) {
                return { buffer: await fs.readFile(outputPath), mimetype: 'video/mp4', ext: '.mp4' };
            }
        }
        return null;
    } finally {
        fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
}
