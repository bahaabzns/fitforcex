import 'package:fitforce_x/core/deeplink/workspace_link.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('parseWorkspaceSlug', () {
    test('parses fitforcex://w/<slug>', () {
      expect(parseWorkspaceSlug(Uri.parse('fitforcex://w/acme')), 'acme');
    });

    test('parses fitforcex://workspace?slug=<slug>', () {
      expect(
        parseWorkspaceSlug(Uri.parse('fitforcex://workspace?slug=acme')),
        'acme',
      );
    });

    test('lowercases the slug', () {
      expect(parseWorkspaceSlug(Uri.parse('fitforcex://w/AcMe')), 'acme');
    });

    test('accepts hyphens and digits', () {
      expect(parseWorkspaceSlug(Uri.parse('fitforcex://w/team-42')), 'team-42');
    });

    test('rejects a foreign scheme', () {
      expect(
          parseWorkspaceSlug(Uri.parse('https://example.com/w/acme')), isNull);
    });

    test('rejects invalid slug characters', () {
      expect(parseWorkspaceSlug(Uri.parse('fitforcex://w/ac me')), isNull);
      expect(parseWorkspaceSlug(Uri.parse('fitforcex://w/acme!')), isNull);
    });

    test('returns null when no slug present', () {
      expect(parseWorkspaceSlug(Uri.parse('fitforcex://w/')), isNull);
      expect(parseWorkspaceSlug(Uri.parse('fitforcex://workspace')), isNull);
    });
  });
}
