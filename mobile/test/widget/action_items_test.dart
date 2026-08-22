import 'package:dio/dio.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/home/action_items_repository.dart';
import 'package:fitforce_x/features/home/home_page.dart';
import 'package:fitforce_x/features/notifications/notifications_repository.dart';
import 'package:fitforce_x/features/progress/progress_repository.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/action_item.dart';
import 'package:fitforce_x/shared/models/transformation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class _FakeActionItemsRepository extends ActionItemsRepository {
  _FakeActionItemsRepository(this._items) : super(Dio());
  final List<ActionItem> _items;

  @override
  Future<List<ActionItem>> fetchActionItems() async => _items;
}

class _FakeProgressRepository extends ProgressRepository {
  _FakeProgressRepository() : super(Dio());

  @override
  Future<TransformationPayload> fetch() async => const TransformationPayload();
}

class _FakeNotificationsRepository extends NotificationsRepository {
  _FakeNotificationsRepository() : super(Dio());
  String? lastMarkedRead;

  @override
  Future<void> markRead(String id) async {
    lastMarkedRead = id;
  }
}

Future<ProviderContainer> _pumpHome(
  WidgetTester tester,
  List<ActionItem> items, {
  _FakeNotificationsRepository? notificationsRepo,
}) async {
  final notifications = notificationsRepo ?? _FakeNotificationsRepository();
  final container = ProviderContainer(overrides: [
    actionItemsRepositoryProvider
        .overrideWithValue(_FakeActionItemsRepository(items)),
    progressRepositoryProvider.overrideWithValue(_FakeProgressRepository()),
    notificationsRepositoryProvider.overrideWithValue(notifications),
  ]);
  addTearDown(container.dispose);

  final router = GoRouter(
    initialLocation: '/home',
    routes: [
      GoRoute(
          path: '/home', builder: (_, __) => const Scaffold(body: HomePage())),
      GoRoute(
          path: '/nutrition',
          builder: (_, __) => const Scaffold(body: Text('nutrition-tab'))),
      GoRoute(
          path: '/training',
          builder: (_, __) => const Scaffold(body: Text('training-tab'))),
      GoRoute(
          path: '/forms/:id',
          builder: (_, __) => const Scaffold(body: Text('form-detail'))),
      GoRoute(
          path: '/profile',
          builder: (_, __) => const Scaffold(body: Text('profile-tab'))),
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
  return container;
}

void main() {
  testWidgets('renders nothing when there are no action items',
      (tester) async {
    await _pumpHome(tester, const []);
    expect(find.text('ACTION NEEDED'), findsNothing);
  });

  testWidgets('shows one tile per item with re-translated title/subtitle',
      (tester) async {
    await _pumpHome(tester, const [
      ActionItem(
        id: 'form-1',
        kind: 'pending_form',
        titleEn: 'Weekly Check-in',
        href: '/portal/forms/form-1',
      ),
      ActionItem(
        id: 'notif-1',
        kind: 'plan_update',
        href: '/portal/training',
      ),
      ActionItem(
        id: 'subscription',
        kind: 'subscription',
        href: 'https://pay.example.com/renew',
      ),
    ]);

    expect(find.text('ACTION NEEDED'), findsOneWidget);
    expect(find.text('Weekly Check-in'), findsOneWidget);
    expect(find.text('Check-in form ready to fill'), findsOneWidget);
    expect(find.text('A new training plan was assigned to you'),
        findsOneWidget);
    expect(find.text('Your subscription is expiring soon'), findsOneWidget);
  });

  testWidgets('tapping a plan_update item marks its notification read',
      (tester) async {
    final notifications = _FakeNotificationsRepository();
    await _pumpHome(
      tester,
      const [
        ActionItem(id: 'notif-1', kind: 'plan_update', href: '/portal/nutrition'),
      ],
      notificationsRepo: notifications,
    );

    await tester.tap(find.text('A new nutrition plan was assigned to you'));
    await tester.pumpAndSettle();

    expect(notifications.lastMarkedRead, 'notif-1');
  });
}
