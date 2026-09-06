import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/food_swap.dart';

/// Talks to `/client-portal/meal-items/:mealItemId/swap*`. Search is
/// backend-driven and every candidate arrives with its equivalent grams +
/// macros already computed server-side — there is no client-side quantity
/// input or calculation anywhere in this feature.
class FoodSwapRepository {
  FoodSwapRepository(this._dio);

  final Dio _dio;

  Future<List<FoodSwapAlternative>> search(
    String mealItemId, {
    String? query,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/client-portal/meal-items/$mealItemId/swap-search',
        queryParameters: {if (query != null && query.isNotEmpty) 'query': query},
      );
      final alternatives = res.data?['alternatives'] as List<dynamic>? ?? [];
      return alternatives
          .map((e) => FoodSwapAlternative.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> swap(String mealItemId, String alternativeFoodId) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '/api/client-portal/meal-items/$mealItemId/swap',
        data: {'alternativeFoodId': alternativeFoodId},
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> reset(String mealItemId) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '/api/client-portal/meal-items/$mealItemId/swap/reset',
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final foodSwapRepositoryProvider = Provider<FoodSwapRepository>(
  (ref) => FoodSwapRepository(ref.watch(dioProvider)),
);
