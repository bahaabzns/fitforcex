import 'package:fitforce_x/core/network/dio_client.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/notifications/notifications_page.dart';
import 'package:fitforce_x/features/notifications/notifications_repository.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/notification.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// A fake repository so the widget test never touches the network — this
/// isolates whether the LOADING → DATA transition itself is broken (a
/// Flutter/Riverpod bug) as opposed to a network/auth/backend problem, which
/// the integration test suite (`clientPortalNotifications.test.ts`) already
/// ruled out against the real server.
class _FakeNotificationsRepository extends NotificationsRepository {
  _FakeNotificationsRepository(this._data) : super(Dio());
  final List<AppNotification> _data;

  @override
  Future<List<AppNotification>> fetch({bool unreadOnly = false}) async => _data;

  @override
  Future<int> fetchUnreadCount() async =>
      _data.where((n) => n.isUnread).length;
}

Widget _wrap(Widget child, {required NotificationsRepository repo}) {
  return ProviderScope(
    overrides: [
      notificationsRepositoryProvider.overrideWithValue(repo),
      dioProvider.overrideWithValue(Dio()), // never hit — repo is faked directly
    ],
    child: MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: child,
    ),
  );
}

void main() {
  testWidgets(
      'NotificationsPage transitions from loading to the notification list',
      (tester) async {
    final repo = _FakeNotificationsRepository([
      AppNotification.fromJson(const {
        'id': 'n1',
        'type': 'message.received',
        'importance': 'actionable',
        'title': 'New message from your coach',
        'created_at': '2026-01-01T00:00:00Z',
      }),
    ]);

    await tester.pumpWidget(_wrap(const NotificationsPage(), repo: repo));

    // Immediately after the first pump, the FutureProvider is still resolving.
    expect(find.byType(CircularProgressIndicator), findsNothing); // uses SkeletonList, not a spinner
    expect(find.text('New message from your coach'), findsNothing);

    // Let the fake repository's Future (and the provider's microtask) resolve.
    await tester.pumpAndSettle();

    expect(find.text('New message from your coach'), findsOneWidget,
        reason:
            'the notification should render once the FutureProvider resolves — '
            'if this fails, the page is genuinely stuck on loading');
  });

  testWidgets('NotificationsPage shows an empty state with zero notifications',
      (tester) async {
    final repo = _FakeNotificationsRepository(const []);
    await tester.pumpWidget(_wrap(const NotificationsPage(), repo: repo));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.notifications_outlined), findsWidgets);
  });
}
