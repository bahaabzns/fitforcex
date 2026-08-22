import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/action_item.dart';

class ActionItemsRepository {
  ActionItemsRepository(this._dio);
  final Dio _dio;

  Future<List<ActionItem>> fetchActionItems() async {
    try {
      final res =
          await _dio.get<List<dynamic>>('/api/client-portal/action-items');
      return (res.data ?? [])
          .map((e) => ActionItem.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final actionItemsRepositoryProvider = Provider<ActionItemsRepository>(
  (ref) => ActionItemsRepository(ref.watch(dioProvider)),
);

/// Best-effort: Home never blocks on this, so a fetch failure just means the
/// strip renders nothing (same as the web's catch-and-empty behavior).
final actionItemsProvider = FutureProvider.autoDispose<List<ActionItem>>((ref) async {
  try {
    return await ref.watch(actionItemsRepositoryProvider).fetchActionItems();
  } catch (_) {
    return const [];
  }
});
