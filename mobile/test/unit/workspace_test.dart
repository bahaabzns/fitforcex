import 'package:fitforce_x/core/auth/workspace.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Workspace', () {
    test('parses the lookup response', () {
      final ws = Workspace.fromJson(const {
        'slug': 'acme',
        'name': 'Acme Coaching',
        'logoUrl': null,
        'brandColor': null,
      });
      expect(ws.slug, 'acme');
      expect(ws.name, 'Acme Coaching');
      expect(ws.logoUrl, isNull);
      expect(ws.brandColor, isNull);
    });

    test('tolerates missing optional fields', () {
      final ws = Workspace.fromJson(const {'slug': 'acme', 'name': 'Acme'});
      expect(ws.logoUrl, isNull);
      expect(ws.brandColor, isNull);
    });
  });
}
