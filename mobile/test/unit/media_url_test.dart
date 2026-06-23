import 'package:fitforce_x/shared/utils/media_url.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('resolveMediaUrl', () {
    const base = 'http://10.0.2.2:4000';

    test('prefixes relative /uploads paths with the API base', () {
      expect(
        resolveMediaUrl('/uploads/x.png', base),
        'http://10.0.2.2:4000/uploads/x.png',
      );
    });

    test('passes absolute URLs through unchanged', () {
      expect(
        resolveMediaUrl('https://cdn.example.com/x.png', base),
        'https://cdn.example.com/x.png',
      );
    });

    test('joins a relative path without a leading slash', () {
      expect(resolveMediaUrl('uploads/x.png', base),
          'http://10.0.2.2:4000/uploads/x.png');
    });

    test('handles a trailing slash on the base', () {
      expect(resolveMediaUrl('/u/x.png', '$base/'),
          'http://10.0.2.2:4000/u/x.png');
    });

    test('returns null for null/empty', () {
      expect(resolveMediaUrl(null, base), isNull);
      expect(resolveMediaUrl('', base), isNull);
    });
  });

  group('youtubeVideoId', () {
    test('extracts from watch URLs', () {
      expect(
          youtubeVideoId('https://www.youtube.com/watch?v=abc123'), 'abc123');
    });
    test('extracts from youtu.be short URLs', () {
      expect(youtubeVideoId('https://youtu.be/abc123'), 'abc123');
    });
    test('extracts from embed URLs', () {
      expect(youtubeVideoId('https://www.youtube.com/embed/abc123'), 'abc123');
    });
    test('returns null for non-YouTube or empty', () {
      expect(youtubeVideoId('https://vimeo.com/123'), isNull);
      expect(youtubeVideoId(null), isNull);
    });
  });
}
