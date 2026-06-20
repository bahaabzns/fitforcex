import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/token_storage.dart';
import '../config/app_config.dart';
import '../config/providers.dart';
import 'auth_interceptor.dart';

/// A broadcast signal raised when any request gets a 401. The auth controller
/// listens and tears down the session; keeping it here avoids an import cycle
/// between the Dio layer and auth.
final unauthorizedSignalProvider = StateProvider<int>((ref) => 0);

/// The single configured Dio instance. Mirrors `client/lib/axios.js`.
final dioProvider = Provider<Dio>((ref) {
  final AppConfig config = ref.watch(appConfigProvider);
  final TokenStorage tokenStorage = ref.watch(tokenStorageProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      headers: {'Accept': 'application/json'},
      // Default validateStatus (2xx only) — non-2xx throws a DioException that
      // repositories convert via ApiException.fromDio, preserving statusCode.
    ),
  );

  dio.interceptors.add(
    AuthInterceptor(
      readToken: tokenStorage.readToken,
      onUnauthorized: () =>
          ref.read(unauthorizedSignalProvider.notifier).state++,
    ),
  );

  if (config.isDev && kDebugMode) {
    dio.interceptors.add(
      LogInterceptor(requestBody: true, responseBody: true, error: true),
    );
  }

  return dio;
});
