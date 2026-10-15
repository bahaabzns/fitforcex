import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/auth_state.dart';
import '../network/dio_client.dart';
import 'portal_branding.dart';

/// The signed-in client's coach branding. Refetched whenever the session changes (login as a
/// different coach's client, logout), and resolves to [PortalBranding.none] on any failure —
/// branding is cosmetic, so it must never block or break the app.
final brandingProvider = FutureProvider<PortalBranding>((ref) async {
  final auth = ref.watch(authControllerProvider);
  if (auth is! Authenticated) return PortalBranding.none;

  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/api/client-portal/branding');
    final data = res.data;
    return data == null ? PortalBranding.none : PortalBranding.fromJson(data);
  } on DioException {
    return PortalBranding.none;
  }
});
