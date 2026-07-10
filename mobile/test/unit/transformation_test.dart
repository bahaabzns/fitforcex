import 'package:fitforce_x/shared/models/transformation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('TransformationPayload.fromJson', () {
    test('parses numeric and image metric history', () {
      final payload = TransformationPayload.fromJson(const {
        'metrics': [
          {
            'id': 'm1',
            'name': 'Weight',
            'unit': 'kg',
            'type': 'number',
            'history': [
              {'date': '2026-01-01T00:00:00Z', 'value': '82.5'},
            ],
          },
          {
            'id': 'm2',
            'name': 'Front Photo',
            'type': 'image',
            'history': [
              {'date': '2026-01-01T00:00:00Z', 'value': 'https://cdn/x.jpg'},
            ],
          },
        ],
        'timeline': [
          {
            'submissionId': 's1',
            'submittedAt': '2026-01-01T00:00:00Z',
            'formTitle': 'Weekly Check-in',
            'answers': [
              {'label': 'Weight', 'answer': '82.5', 'metricType': 'number'},
            ],
          },
        ],
      });

      expect(payload.metrics, hasLength(2));
      expect(payload.metrics.first.isImage, isFalse);
      expect(payload.metrics.last.isImage, isTrue);
      expect(payload.timeline.single.answers.single.answer, '82.5');
    });

    test('empty payload (no check-ins yet) parses to empty lists', () {
      final payload = TransformationPayload.fromJson(const {});
      expect(payload.metrics, isEmpty);
      expect(payload.timeline, isEmpty);
    });
  });
}
