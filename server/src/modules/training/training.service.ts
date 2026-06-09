import { makeUploader } from '../../lib/storage';

export type FileBag = { [fieldname: string]: Express.MulterS3.File[] };

export const upload = makeUploader(
    (file: Express.Multer.File) => file.fieldname === 'video' ? 'exercise-library/videos' : 'exercise-library/thumbnails',
    null,
    {
        maxSize:    5 * 1024 * 1024,
        fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: import('multer').FileFilterCallback) => {
            if (file.fieldname === 'video') {
                if (!file.mimetype.startsWith('video/')) return cb(new Error('Video must be a video file'));
                return cb(null, true);
            }
            if (file.fieldname === 'thumbnail') {
                if (!file.mimetype.startsWith('image/')) return cb(new Error('Thumbnail must be an image file'));
                return cb(null, true);
            }
            cb(null, true);
        },
    }
);
