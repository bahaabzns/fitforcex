import 'package:dio/dio.dart';

/// Attaches the bearer token to every request and funnels 401s to a single
/// handler (the parallel of the web axios catch that bounces to login).
///
/// Decoupled from storage/auth via callbacks to avoid import cycles.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required this.readToken,
    required this.onUnauthorized,
  });

  final Future<String?> Function() readToken;
  final void Function() onUnauthorized;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await readToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      onUnauthorized();
    }
    handler.next(err);
  }
}
