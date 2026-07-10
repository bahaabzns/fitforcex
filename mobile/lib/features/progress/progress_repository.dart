import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/transformation.dart';

/// Talks to `GET /client-portal/transformation` — body-measurement/photo
/// history extracted from check-in answers, plus the submission timeline.
class ProgressRepository {
  ProgressRepository(this._dio);

  final Dio _dio;

  Future<TransformationPayload> fetch() async {
    try {
      final res = await _dio
          .get<Map<String, dynamic>>('/api/client-portal/transformation');
      return TransformationPayload.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final progressRepositoryProvider = Provider<ProgressRepository>(
  (ref) => ProgressRepository(ref.watch(dioProvider)),
);

final transformationProvider =
    FutureProvider.autoDispose<TransformationPayload>((ref) {
  return ref.watch(progressRepositoryProvider).fetch();
});
