/// Resolves a stored media path to a fully-qualified URL.
///
/// The server's `toPublicUrl` returns either an absolute S3 URL (prod) or a
/// relative `/uploads/...` path (dev). Mobile has no proxy, so relative paths
/// are prefixed with the API base URL.
String? resolveMediaUrl(String? path, String baseUrl) {
  if (path == null || path.isEmpty) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  final base = baseUrl.endsWith('/')
      ? baseUrl.substring(0, baseUrl.length - 1)
      : baseUrl;
  return path.startsWith('/') ? '$base$path' : '$base/$path';
}

/// Extracts the YouTube video id from common URL shapes, or `null`.
String? youtubeVideoId(String? url) {
  if (url == null || url.isEmpty) return null;
  final match = RegExp(
    r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([^&\s?]+)',
  ).firstMatch(url);
  return match?.group(1);
}
