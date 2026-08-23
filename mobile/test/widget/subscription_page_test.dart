import 'package:dio/dio.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/profile/subscription_page.dart';
import 'package:fitforce_x/features/profile/subscription_repository.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/subscription.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class _FakeSubscriptionRepository extends SubscriptionRepository {
  _FakeSubscriptionRepository(this._summary) : super(Dio());
  final SubscriptionSummary _summary;

  @override
  Future<SubscriptionSummary> fetch() async => _summary;
}

Future<void> _pumpSubscriptionPage(
  WidgetTester tester, {
  required SubscriptionSummary summary,
}) async {
  final container = ProviderContainer(overrides: [
    subscriptionRepositoryProvider
        .overrideWithValue(_FakeSubscriptionRepository(summary)),
  ]);
  addTearDown(container.dispose);

  final router = GoRouter(
    initialLocation: '/subscription',
    routes: [
      GoRoute(
        path: '/subscription',
        builder: (_, __) => const SubscriptionPage(),
      ),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        theme: AppTheme.light,
        routerConfig: router,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('ar')],
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows the no-subscription state when there is no plan',
      (tester) async {
    await _pumpSubscriptionPage(tester, summary: const SubscriptionSummary());

    expect(
      find.text(
          "You don't have an active subscription yet. Contact your coach to get started."),
      findsOneWidget,
    );
  });

  testWidgets(
      'Active plan shows the plan card, renews-on date, progress bar, and no renew CTA',
      (tester) async {
    final now = DateTime.now();
    final start = now.subtract(const Duration(days: 10));
    final end = now.add(const Duration(days: 20));

    await _pumpSubscriptionPage(
      tester,
      summary: SubscriptionSummary(
        status: 'Active',
        plan: const SubscriptionPlan(
            name: 'Premium — Monthly', price: 50, currency: 'USD', durationDays: 30),
        currentPeriodStart: start.toIso8601String(),
        currentPeriodEnd: end.toIso8601String(),
      ),
    );

    expect(find.text('Premium — Monthly'), findsOneWidget);
    expect(find.text('Active'), findsOneWidget);
    expect(find.text('Renews on'), findsOneWidget);
    expect(find.text('20/30 days remaining'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.text('Renew subscription'), findsNothing);
  });

  testWidgets('Expired plan shows the expired-on date and the renew CTA',
      (tester) async {
    await _pumpSubscriptionPage(
      tester,
      summary: const SubscriptionSummary(
        status: 'Expired',
        plan: SubscriptionPlan(name: 'Basic'),
        currentPeriodEnd: '2026-07-01T00:00:00Z',
        renewalLink: 'https://pay.example.com/renew',
      ),
    );

    expect(find.text('Expired on'), findsOneWidget);
    expect(find.text('Renew subscription'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);

    final button =
        tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Renew subscription'));
    expect(button.onPressed, isNotNull);
  });

  testWidgets('renew CTA is disabled when there is no renewal link',
      (tester) async {
    await _pumpSubscriptionPage(
      tester,
      summary: const SubscriptionSummary(
        status: 'Frozen',
        plan: SubscriptionPlan(name: 'Basic'),
        frozenUntil: '2026-09-01T00:00:00Z',
      ),
    );

    final button =
        tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Renew subscription'));
    expect(button.onPressed, isNull);
  });

  testWidgets('lists payment history with amount and status',
      (tester) async {
    await _pumpSubscriptionPage(
      tester,
      summary: const SubscriptionSummary(
        plan: SubscriptionPlan(name: 'Basic'),
        transactions: [
          SubscriptionTransaction(
            id: 'tx-1',
            packageVariation: 'Basic — Monthly',
            amount: 100,
            currency: 'USD',
            date: '2026-07-01T00:00:00Z',
            subscriptionStatus: 'Refunded',
          ),
        ],
      ),
    );

    expect(find.text('Basic — Monthly'), findsOneWidget);
    expect(find.text('100 USD'), findsOneWidget);
    expect(find.text('Refunded'), findsOneWidget);
  });

  testWidgets('shows "No payment history yet." when transactions is empty',
      (tester) async {
    await _pumpSubscriptionPage(
      tester,
      summary: const SubscriptionSummary(plan: SubscriptionPlan(name: 'Basic')),
    );

    expect(find.text('No payment history yet.'), findsOneWidget);
  });
}
