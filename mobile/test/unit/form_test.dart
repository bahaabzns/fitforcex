import 'package:fitforce_x/shared/models/form.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FormRequestSummary.fromJson', () {
    test('maps snake_case request fields', () {
      final r = FormRequestSummary.fromJson(const {
        'id': 'r1',
        'status': 'pending',
        'requested_at': '2026-01-01T00:00:00Z',
        'form_title_en': 'Check-in',
        'form_title_ar': 'تسجيل',
      });
      expect(r.id, 'r1');
      expect(r.status, formStatusPending);
      expect(r.formTitleEn, 'Check-in');
      expect(r.formTitleAr, 'تسجيل');
    });
  });

  group('FormRequestDetail.fromJson', () {
    test('parses questions (options + types) and responses', () {
      final d = FormRequestDetail.fromJson(const {
        'id': 'r1',
        'status': 'submitted',
        'form_title_en': 'Weekly',
        'questions': [
          {
            'id': 'q1',
            'type': 'select',
            'label_en': 'Mood',
            'label_ar': 'المزاج',
            'required': true,
            'options': ['Good', 'Bad'],
            'options_ar': ['جيد', 'سيئ'],
          },
          {
            'id': 'q2',
            'type': 'scale',
            'label_en': 'Energy',
            'min_value': 1,
            'max_value': 5,
          },
        ],
        'responses': [
          {
            'question_id': 'q1',
            'answer': 'Good',
            'edited': true,
            'history': [
              {
                'previous_answer': 'Bad',
                'new_answer': 'Good',
                'edited_at': '2026-08-20T10:00:00Z',
              },
            ],
          },
        ],
      });

      expect(d.questions.length, 2);
      final q1 = d.questions.first;
      expect(q1.type, 'select');
      expect(q1.required, isTrue);
      expect(q1.options, ['Good', 'Bad']);
      expect(q1.optionsAr, ['جيد', 'سيئ']);
      expect(d.questions[1].maxValue, 5);
      expect(d.responses.single.answer, 'Good');
      expect(d.responses.single.edited, isTrue);
      expect(d.responses.single.history.single.previousAnswer, 'Bad');
      expect(d.responses.single.history.single.newAnswer, 'Good');
    });

    test('defaults edited to false and history to empty when absent', () {
      final d = FormRequestDetail.fromJson(const {
        'id': 'r1',
        'responses': [
          {'question_id': 'q1', 'answer': 'Good'},
        ],
      });
      expect(d.responses.single.edited, isFalse);
      expect(d.responses.single.history, isEmpty);
    });

    test('defaults options to empty when null/absent', () {
      final d = FormRequestDetail.fromJson(const {
        'id': 'r1',
        'questions': [
          {'id': 'q1', 'type': 'text', 'label_en': 'Name', 'options': null},
        ],
      });
      expect(d.questions.single.options, isEmpty);
      expect(d.questions.single.optionsAr, isEmpty);
    });
  });
}
