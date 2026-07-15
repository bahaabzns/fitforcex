/** Extracts a YouTube video id from watch/share/embed/shorts URL forms, or null. */
export function getYoutubeVideoId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\s?]+)/);
    return m?.[1] ?? null;
}

/** Extracts a YouTube video id from watch/share/embed/shorts URL forms and returns an embeddable URL, or null. */
export function getYoutubeEmbedUrl(url) {
    const id = getYoutubeVideoId(url);
    return id ? `https://www.youtube.com/embed/${id}` : null;
}
