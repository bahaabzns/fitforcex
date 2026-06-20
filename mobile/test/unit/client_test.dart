import 'package:fitforce_x/core/auth/client.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Client', () {
    test('parses snake_case JSON from /me', () {
      final client = Client.fromJson(const {
        'id': 'c1',
        'fname': 'Bahaa',
        'lname': 'Ahmed',
        'email': 'b@example.com',
        'workspace_id': 'w1',
        'client_code': '1024',
      });
      expect(client.fullName, 'Bahaa Ahmed');
      expect(client.initials, 'BA');
      expect(client.clientCode, '1024');
      expect(client.workspaceId, 'w1');
    });

    test('initials fall back to ? when name is empty', () {
      final client = Client.fromJson(const {
        'id': 'c1',
        'workspace_id': 'w1',
      });
      expect(client.initials, '?');
    });
  });
}
