import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/auth_state.dart';
import 'access_cache.dart';
import 'access_repository.dart';
import 'client_access.dart';

/// Owns the client's resolved access. Rebuilds whenever auth changes (login /
/// app reopen / forced logout), and exposes [refresh] for pull-to-refresh and
/// post-renewal. Falls back to the cached access when the network is down so the
/// app keeps working offline; the backend stays the source of truth on reconnect.
class AccessController extends AsyncNotifier<ClientAccess> {
  @override
  Future<ClientAccess> build() async {
    final auth = ref.watch(authControllerProvider);
    if (auth is! Authenticated) {
      // Signed out → clear the cached snapshot and present a neutral default.
      await ref.read(accessCacheProvider).clear();
      return ClientAccess.allAllowed();
    }
    return _load();
  }

  Future<ClientAccess> _load() async {
    final cache = ref.read(accessCacheProvider);
    try {
      final access = await ref.read(accessRepositoryProvider).fetchAccess();
      await cache.save(access);
      return access;
    } catch (e) {
      // Offline / transient failure → last-known permissions, if any.
      final cached = await cache.read();
      if (cached != null) return cached;
      rethrow;
    }
  }

  /// Re-fetches access. Call after a renewal/payment, on pull-to-refresh, and on
  /// app resume. Keeps the previous value visible while reloading.
  Future<void> refresh() async {
    state = const AsyncValue<ClientAccess>.loading().copyWithPrevious(state);
    state = await AsyncValue.guard(_load);
  }
}

final accessControllerProvider =
    AsyncNotifierProvider<AccessController, ClientAccess>(AccessController.new);

/// Synchronous view of the current access for the permission layer. Defaults to
/// fully-allowed while loading/erroring so an active client is never briefly
/// locked out (the backend still enforces every gate).
final clientAccessProvider = Provider<ClientAccess>((ref) {
  return ref.watch(accessControllerProvider).valueOrNull ??
      ClientAccess.allAllowed();
});
