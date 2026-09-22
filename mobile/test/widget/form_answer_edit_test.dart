import 'package:dio/dio.dart';
import 'package:fitforce_x/core/access/access_controller.dart';
import 'package:fitforce_x/core/access/client_access.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/forms/form_fill_page.dart';
import 'package:fitforce_x/features/forms/forms_repository.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/form.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _requestId = 'req-1';

FormRequestDetail _detail({required bool edited}) => FormRequestDetail(
      id: _requestId,
      status: formStatusSubmitted,
      formTitleEn: 'Weekly Check-in',
      questions: const [
        FormQuestion(id: 'q1', type: 'text', labelEn: 'How do you feel?'),
      ],
      responses: [
        FormResponse(
          questionId: 'q1',
          answer: 'Good',
          edited: edited,
          history: edited
              ? const [
                  AnswerEditEntry(
                    previousAnswer: 'Okay',
                    newAnswer: 'Good',
                    editedAt: '2026-08-20T10:00:00Z',
                  ),
                ]
              : const [],
        ),
      ],
    );

class _FakeFormsRepository extends FormsRepository {
  _FakeFormsRepository(this._detail) : super(Dio());
  FormRequestDetail _detail;
  String? lastEditedAnswer;
  bool editThrows = false;

  @override
  Future<FormRequestDetail> fetchRequest(String id) async => _detail;

  @override
  Future<void> editAnswer(
      String requestId, String questionId, String answer) async {
    if (editThrows) throw Exception('boom');
    lastEditedAnswer = answer;
    _detail = _detail.copyWith(
      responses: [
        FormResponse(questionId: questionId, answer: answer, edited: true),
      ],
    );
  }
}

Future<_FakeFormsRepository> _pumpForm(
  WidgetTester tester, {
  required bool edited,
}) async {
  final fake = _FakeFormsRepository(_detail(edited: edited));
  final container = ProviderContainer(overrides: [
    formsRepositoryProvider.overrideWithValue(fake),
    clientAccessProvider.overrideWithValue(ClientAccess.allAllowed()),
  ]);
  addTearDown(container.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        theme: AppTheme.light,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('ar')],
        home: const FormFillPage(requestId: _requestId),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return fake;
}

void main() {
  testWidgets('shows an Edit answer button once submitted, no Edited chip',
      (tester) async {
    await _pumpForm(tester, edited: false);
    expect(find.text('Edit answer'), findsOneWidget);
    expect(find.text('Edited'), findsNothing);
  });

  testWidgets('shows the Edited chip and history when already edited',
      (tester) async {
    await _pumpForm(tester, edited: true);
    expect(find.text('Edited'), findsOneWidget);
    expect(find.text('Okay'), findsOneWidget);
    expect(find.text('Good'), findsWidgets);
  });

  testWidgets('editing an answer unlocks the field and calls the repository',
      (tester) async {
    final fake = await _pumpForm(tester, edited: false);

    await tester.tap(find.text('Edit answer'));
    await tester.pumpAndSettle();

    expect(find.text('Save'), findsOneWidget);
    expect(find.text('Cancel'), findsOneWidget);

    await tester.enterText(find.byType(TextFormField), 'Great');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(fake.lastEditedAnswer, 'Great');
    expect(find.text('Edit answer'), findsOneWidget);
  });

  testWidgets('cancel reverts the field to the original answer',
      (tester) async {
    await _pumpForm(tester, edited: false);

    await tester.tap(find.text('Edit answer'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), 'Something else');
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    expect(find.text('Good'), findsOneWidget);
    expect(find.text('Edit answer'), findsOneWidget);
  });
}
