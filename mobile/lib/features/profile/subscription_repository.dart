import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/subscription.dart';

/// Reads the client's subscription summary
/// (`GET /client-portal/subscription`) — plan, current period, and payment
/// history. Shared between the profile page's summary row and the full
/// subscription page.
class SubscriptionRepository {
  SubscriptionRepository(this._dio);

  final Dio _dio;

  Future<SubscriptionSummary> fetch() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/client-portal/subscription',
      );
      return SubscriptionSummary.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final subscriptionRepositoryProvider = Provider<SubscriptionRepository>(
  (ref) => SubscriptionRepository(ref.watch(dioProvider)),
);

/// Deliberately not `.autoDispose` — both the profile row and the full
/// subscription page read this, and the profile row is the more common
/// entry point, so keeping it warm avoids a duplicate fetch when the client
/// then opens the subscription page a moment later.
final subscriptionProvider =
    FutureProvider<SubscriptionSummary>((ref) {
  return ref.watch(subscriptionRepositoryProvider).fetch();
});
