import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/notification.dart';

/// Talks to `/client-portal/notifications/*` — list, unread count, mark-read.
class NotificationsRepository {
  NotificationsRepository(this._dio);

  final Dio _dio;

  Future<List<AppNotification>> fetch({bool unreadOnly = false}) async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/api/client-portal/notifications',
        queryParameters: {'limit': 30, if (unreadOnly) 'unread': 'true'},
      );
      return (res.data ?? [])
          .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<int> fetchUnreadCount() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/client-portal/notifications/unread-count',
      );
      return (res.data?['count'] as num?)?.toInt() ?? 0;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _dio.patch<void>('/api/client-portal/notifications/$id/read');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> markAllRead() async {
    try {
      await _dio.patch<void>('/api/client-portal/notifications/read-all');
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final notificationsRepositoryProvider = Provider<NotificationsRepository>(
  (ref) => NotificationsRepository(ref.watch(dioProvider)),
);

final notificationsProvider =
    FutureProvider.autoDispose<List<AppNotification>>((ref) {
  return ref.watch(notificationsRepositoryProvider).fetch();
});

/// Polled every 15s, mirroring the web nav's poll interval — the single
/// source of truth for "what's unread right now." Both the shell bell badge
/// and the Messages bottom-nav dot derive from this one stream instead of
/// polling separately, per the reuse-don't-duplicate rule for unread state.
final unreadNotificationsProvider =
    StreamProvider.autoDispose<List<AppNotification>>((ref) async* {
  final repo = ref.watch(notificationsRepositoryProvider);
  while (true) {
    try {
      yield await repo.fetch(unreadOnly: true);
    } catch (_) {
      // best-effort — keep the last known value on a transient failure
    }
    await Future<void>.delayed(const Duration(seconds: 15));
  }
});

final unreadNotificationsCountProvider = Provider.autoDispose<int>((ref) {
  return ref.watch(unreadNotificationsProvider).asData?.value.length ?? 0;
});

/// Drives the Messages bottom-nav dot: reuses the `message.received`
/// notification (already unread-tracked server-side) instead of a separate
/// "unread messages" mechanism. Opening the thread marks both the messages
/// and this notification read server-side (`getMessages` syncs `read_at` on
/// the linked `entity_type: 'thread'` notification row).
final hasUnreadMessageProvider = Provider.autoDispose<bool>((ref) {
  final unread = ref.watch(unreadNotificationsProvider).asData?.value ?? const [];
  return unread.any((n) => n.type == 'message.received');
});
