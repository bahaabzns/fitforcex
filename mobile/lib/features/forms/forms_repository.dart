import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/form.dart';

/// Talks to `/client-portal/form-requests/*` — list, fetch one, submit answers.
class FormsRepository {
  FormsRepository(this._dio);

  final Dio _dio;

  Future<List<FormRequestSummary>> fetchRequests() async {
    try {
      final res =
          await _dio.get<List<dynamic>>('/api/client-portal/form-requests');
      return (res.data ?? [])
          .map((e) => FormRequestSummary.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<FormRequestDetail> fetchRequest(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/client-portal/form-requests/$id',
      );
      return FormRequestDetail.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> submit(String id, Map<String, String> answers) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '/api/client-portal/form-requests/$id/submit',
        data: {
          'answers': [
            for (final entry in answers.entries)
              {'question_id': entry.key, 'answer': entry.value},
          ],
        },
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> editAnswer(
    String requestId,
    String questionId,
    String answer,
  ) async {
    try {
      await _dio.patch<Map<String, dynamic>>(
        '/api/client-portal/form-requests/$requestId/answers/$questionId',
        data: {'answer': answer},
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final formsRepositoryProvider = Provider<FormsRepository>(
  (ref) => FormsRepository(ref.watch(dioProvider)),
);

final formRequestsProvider =
    FutureProvider.autoDispose<List<FormRequestSummary>>((ref) {
  return ref.watch(formsRepositoryProvider).fetchRequests();
});

final formRequestProvider =
    FutureProvider.autoDispose.family<FormRequestDetail, String>((ref, id) {
  return ref.watch(formsRepositoryProvider).fetchRequest(id);
});
