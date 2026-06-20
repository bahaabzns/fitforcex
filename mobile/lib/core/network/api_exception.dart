import 'package:dio/dio.dart';

/// One error shape for the whole app. The backend returns `{ message }` or
/// `{ error }`; we normalise both into [message] and keep [statusCode] so
/// callers can branch on 401/404 etc. without touching Dio types.
class ApiException implements Exception {
  const ApiException({
    required this.message,
    this.statusCode,
    this.isNetworkError = false,
  });

  final String message;
  final int? statusCode;
  final bool isNetworkError;

  bool get isUnauthorized => statusCode == 401;
  bool get isNotFound => statusCode == 404;

  factory ApiException.fromDio(DioException e) {
    final status = e.response?.statusCode;
    final data = e.response?.data;

    final serverMessage = switch (data) {
      {'message': final String m} when m.trim().isNotEmpty => m,
      {'error': final String m} when m.trim().isNotEmpty => m,
      _ => null,
    };

    final isNetwork = switch (e.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout ||
      DioExceptionType.connectionError =>
        true,
      _ => false,
    };

    return ApiException(
      message: serverMessage ??
          (isNetwork
              ? 'Network error — check your connection and try again.'
              : 'Something went wrong. Please try again.'),
      statusCode: status,
      isNetworkError: isNetwork,
    );
  }

  @override
  String toString() => 'ApiException($statusCode): $message';
}
