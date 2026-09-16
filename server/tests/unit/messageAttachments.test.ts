import { Readable } from 'stream';
import { resolveAttachmentContentType } from '../../src/lib/messageAttachments';

// A minimal ISO-BMFF `ftyp` box shaped like Safari's MediaRecorder audio/mp4
// output: a 24-byte ("0x18") box carrying the "M4A " major brand.
const SAFARI_M4A_FTYP_BOX = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, // size=24, "ftyp"
    0x4d, 0x34, 0x41, 0x20,                         // major_brand = "M4A "
    0x00, 0x00, 0x00, 0x00,                         // minor_version
    0x4d, 0x34, 0x41, 0x20, 0x6d, 0x70, 0x34, 0x32, // compatible brands
]);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('resolveAttachmentContentType', () => {
    // Documents the root cause: the bundled file-type@3 checks a generic
    // ftyp+box-size signature for "video/mp4" before it ever inspects the brand
    // for "audio/m4a", so a real Safari voice-note recording is misclassified as
    // a video. That wrong Content-Type is what made Safari's <audio> element
    // refuse to play client-portal voice notes.
    test('the underlying file-type sniffer misclassifies a Safari voice note as video/mp4', () => {
        const fileType = require('file-type');
        expect(fileType(SAFARI_M4A_FTYP_BOX)).toEqual({ ext: 'mp4', mime: 'video/mp4' });
    });

    test('trusts the browser-declared mimetype for a voice note instead of sniffing it', done => {
        const file = { mimetype: 'audio/mp4' } as Express.Multer.File;
        resolveAttachmentContentType({} as Express.Request, file, (err, mime, stream) => {
            expect(err).toBeNull();
            expect(mime).toBe('audio/mp4');
            expect(stream).toBeUndefined();
            done();
        });
    });

    test('still byte-sniffs non-audio attachments (unchanged behavior)', done => {
        const file = {
            mimetype: 'application/octet-stream',
            stream: Readable.from([PNG_SIGNATURE]),
        } as unknown as Express.Multer.File;

        resolveAttachmentContentType({} as Express.Request, file, (err, mime, stream) => {
            expect(err).toBeNull();
            expect(mime).toBe('image/png');
            expect(stream).toBeDefined();
            done();
        });
    });
});
