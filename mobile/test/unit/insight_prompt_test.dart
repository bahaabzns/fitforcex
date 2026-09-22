import 'package:fitforce_x/shared/models/insight_prompt.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('InsightPrompt.fromJson', () {
    test('parses a rating prompt with snake_case keys', () {
      final p = InsightPrompt.fromJson(const {
        'id': 'p1',
        'question_en': 'How likely are you to recommend us?',
        'response_type': 'rating',
        'scale_max': 10,
      });
      expect(p.id, 'p1');
      expect(p.questionEn, 'How likely are you to recommend us?');
      expect(p.responseType, 'rating');
      expect(p.scaleMax, 10);
      expect(p.options, isNull);
    });

    test('parses a multiple_choice prompt with options', () {
      final p = InsightPrompt.fromJson(const {
        'id': 'p2',
        'question_en': 'Which feature do you use most?',
        'response_type': 'multiple_choice',
        'options': ['Nutrition', 'Training', 'Forms'],
      });
      expect(p.options, ['Nutrition', 'Training', 'Forms']);
    });

    test('defaults scale_max to 10 when absent', () {
      final p = InsightPrompt.fromJson(const {
        'id': 'p3',
        'question_en': 'Tell us more',
        'response_type': 'text',
      });
      expect(p.scaleMax, 10);
    });
  });
}
