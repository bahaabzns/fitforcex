import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_exception.dart';
import '../network/dio_client.dart';
import 'client.dart';
import 'token_storage.dart';

/// Talks to `/client-portal/{login,logout,me}`. Owns token persistence so the
/// controller stays thin.
class AuthRepository {
  AuthRepository(this._dio, this._tokenStorage);

  final Dio _dio;
  final TokenStorage _tokenStorage;

  /// Logs in and persists the bearer token.
  ///
  /// Depends on backend change #1: `/login` returning `{ token }` in the body.
  /// If the field is missing (current cookie-only backend), this throws so the
  /// UI can surface that the mobile token endpoint isn't live yet.
  Future<void> login({
    required String workspaceSlug,
    required String email,
    required String password,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/client-portal/login',
        data: {
          'email': email,
          'password': password,
          'workspace_slug': workspaceSlug,
        },
      );

      final token = res.data?['token'] as String?;
      if (token == null || token.isEmpty) {
        throw const ApiException(
          message:
              'Login succeeded but no token was returned. The mobile token '
              'endpoint is not enabled yet (backend change #1).',
        );
      }

      await _tokenStorage.writeToken(token);
      await _tokenStorage.writeWorkspaceSlug(workspaceSlug.trim());
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Client> fetchMe() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/api/client-portal/me');
      return Client.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Explicit user logout: clears the token *and* the remembered workspace,
  /// so the next login starts from the email step again.
  Future<void> logout() async {
    try {
      await _dio.post<void>('/api/client-portal/logout');
    } on DioException {
      // Best-effort; we clear local state regardless.
    } finally {
      await _tokenStorage.clearAll();
    }
  }
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(
    ref.watch(dioProvider),
    ref.watch(tokenStorageProvider),
  ),
);
