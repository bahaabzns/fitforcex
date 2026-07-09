import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_exception.dart';
import '../network/dio_client.dart';
import 'workspace.dart';

/// Resolves workspaces for the login flow: by slug (branding lookup, used for
/// deep-link pre-branding) or by email (workspace discovery, so the client
/// never has to know or enter a slug).
class WorkspaceRepository {
  WorkspaceRepository(this._dio);

  final Dio _dio;

  /// Returns the [Workspace] for [slug], or `null` when no such workspace
  /// exists (HTTP 404). Other failures throw [ApiException].
  Future<Workspace?> lookup(String slug) async {
    final trimmed = slug.trim();
    if (trimmed.isEmpty) return null;
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/client-portal/workspace',
        queryParameters: {'slug': trimmed},
      );
      return Workspace.fromJson(res.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw ApiException.fromDio(e);
    }
  }

  /// Resolves every workspace with a client matching [email]. Empty when no
  /// account was found (HTTP 404) — that's a normal outcome, not an error.
  /// Other failures throw [ApiException].
  Future<List<Workspace>> discoverByEmail(String email) async {
    final trimmed = email.trim();
    if (trimmed.isEmpty) return const [];
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/client-portal/discover-workspace',
        data: {'email': trimmed},
      );
      final raw = res.data?['workspaces'] as List<dynamic>? ?? const [];
      return raw
          .map((e) => Workspace.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return const [];
      throw ApiException.fromDio(e);
    }
  }
}

final workspaceRepositoryProvider = Provider<WorkspaceRepository>(
  (ref) => WorkspaceRepository(ref.watch(dioProvider)),
);

/// Looks up a workspace by slug. Family arg is the (already-trimmed) slug.
/// Returns `null` for an unknown slug so the UI can show "not found" without an
/// error state.
final workspaceLookupProvider =
    FutureProvider.autoDispose.family<Workspace?, String>((ref, slug) {
  if (slug.trim().isEmpty) return Future.value(null);
  return ref.watch(workspaceRepositoryProvider).lookup(slug);
});
