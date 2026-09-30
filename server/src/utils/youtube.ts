/**
 * Extracts a YouTube video id from watch/share/embed/shorts URL forms, or null.
 * Mirrors client/utils/video.js:getYoutubeVideoId — kept in sync manually since
 * the client and server packages don't share a common module.
 */
export function getYoutubeVideoId(url: string): string | null {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\s?]+)/);
    return m?.[1] ?? null;
}
