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

/// `.autoDispose` so a client who renews externally (leaves the app, pays,
/// comes back) sees the refreshed status instead of a cached "Expired"/
/// "Frozen" for the rest of the app session — both the profile row and the
/// full subscription page watch this, so it stays warm across the brief
/// profile-row → subscription-page transition and only refetches once
/// nothing is watching it (e.g. after leaving and returning to the app).
final subscriptionProvider =
    FutureProvider.autoDispose<SubscriptionSummary>((ref) {
  return ref.watch(subscriptionRepositoryProvider).fetch();
});
