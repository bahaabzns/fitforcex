import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/dio_client.dart';
import 'auth_repository.dart';
import 'auth_state.dart';
import 'token_storage.dart';

/// Owns the session lifecycle. Starts in [AuthUnknown], resolves to
/// [Authenticated] / [Unauthenticated] after bootstrap, and reacts to global
/// 401s by tearing the session down (the parallel of the web redirect-to-login).
class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    // Any 401 anywhere → drop to unauthenticated.
    ref.listen<int>(unauthorizedSignalProvider, (prev, next) {
      if (next != (prev ?? 0)) {
        unawaited(
          _forceLogout(message: 'Your session expired. Please sign in again.'),
        );
      }
    });

    // Kick off the async bootstrap without blocking the initial state.
    unawaited(Future.microtask(_bootstrap));
    return const AuthUnknown();
  }

  AuthRepository get _repo => ref.read(authRepositoryProvider);
  TokenStorage get _tokens => ref.read(tokenStorageProvider);

  Future<void> _bootstrap() async {
    final token = await _tokens.readToken();
    if (token == null || token.isEmpty) {
      state = const Unauthenticated();
      return;
    }
    try {
      final client = await _repo.fetchMe();
      state = Authenticated(client);
    } catch (_) {
      await _tokens.clear();
      state = const Unauthenticated();
    }
  }

  /// Throws [ApiException] on failure so the login screen can show the message.
  Future<void> login({
    required String workspaceSlug,
    required String email,
    required String password,
  }) async {
    await _repo.login(
      workspaceSlug: workspaceSlug,
      email: email,
      password: password,
    );
    final client = await _repo.fetchMe();
    state = Authenticated(client);
  }

  Future<void> logout() async {
    await _repo.logout();
    state = const Unauthenticated();
  }

  Future<void> _forceLogout({String? message}) async {
    await _tokens.clear();
    if (state is! Unauthenticated) {
      state = Unauthenticated(message: message);
    }
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
