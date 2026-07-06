import { makeUploader } from './storage';

// Observations support a single optional image attachment — no audio/PDF/etc.,
// matching the feature's "extremely lightweight" scope.
const ALLOWED_OBSERVATION_ATTACHMENT_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic'];

export const observationAttachmentUploader = makeUploader(
    'observation-attachments',
    ALLOWED_OBSERVATION_ATTACHMENT_EXTS,
    { maxSize: 10 * 1024 * 1024 },
);
