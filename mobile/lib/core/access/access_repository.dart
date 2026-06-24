import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_exception.dart';
import '../network/dio_client.dart';
import 'client_access.dart';

/// Reads the client's resolved access from `GET /client-portal/access`. The
/// backend computes status + applies policy/grace; we never duplicate that here.
class AccessRepository {
  AccessRepository(this._dio);

  final Dio _dio;

  Future<ClientAccess> fetchAccess() async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>('/api/client-portal/access');
      final data = res.data;
      if (data == null) return ClientAccess.allAllowed();
      return ClientAccess.fromJson(data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final accessRepositoryProvider = Provider<AccessRepository>(
  (ref) => AccessRepository(ref.watch(dioProvider)),
);
