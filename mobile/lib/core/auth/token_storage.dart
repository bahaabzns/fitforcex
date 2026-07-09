import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'workspace.dart';

/// A remembered workspace + email from a prior successful login, used to skip
/// straight to the password step on the next launch.
class RememberedLogin {
  const RememberedLogin({required this.workspace, required this.email});
  final Workspace workspace;
  final String email;
}

/// Persists the bearer token, the resolved workspace, and the "remember me"
/// email in the OS keystore/keychain.
///
/// [clear] drops only the auth token (used on token expiry / an invalid
/// bootstrap token) so a remembered workspace still lets the next launch skip
/// discovery and go straight to the password step. [clearAll] additionally
/// forgets the workspace + email — used on an explicit user logout, per the
/// "logout clears credentials" rule.
class TokenStorage {
  TokenStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const _kToken = 'client_token';
  static const _kWorkspaceSlug = 'workspace_slug';
  static const _kWorkspaceName = 'workspace_name';
  static const _kWorkspaceLogoUrl = 'workspace_logo_url';
  static const _kRememberedEmail = 'remembered_email';

  Future<String?> readToken() => _storage.read(key: _kToken);
  Future<void> writeToken(String token) =>
      _storage.write(key: _kToken, value: token);

  Future<String?> readWorkspaceSlug() => _storage.read(key: _kWorkspaceSlug);
  Future<void> writeWorkspaceSlug(String slug) =>
      _storage.write(key: _kWorkspaceSlug, value: slug);

  /// The remembered workspace + email from the last successful login, or
  /// `null` if nothing (or an incomplete pair) is stored.
  Future<RememberedLogin?> readRememberedLogin() async {
    final slug = await _storage.read(key: _kWorkspaceSlug);
    final email = await _storage.read(key: _kRememberedEmail);
    if (slug == null || slug.isEmpty || email == null || email.isEmpty) {
      return null;
    }
    final name = await _storage.read(key: _kWorkspaceName);
    final logoUrl = await _storage.read(key: _kWorkspaceLogoUrl);
    return RememberedLogin(
      workspace: Workspace(slug: slug, name: name ?? '', logoUrl: logoUrl),
      email: email,
    );
  }

  /// Called after a successful login: remembers the workspace + email so the
  /// next launch can skip workspace discovery.
  Future<void> writeRememberedLogin({
    required Workspace workspace,
    required String email,
  }) async {
    await _storage.write(key: _kWorkspaceSlug, value: workspace.slug);
    await _storage.write(key: _kWorkspaceName, value: workspace.name);
    if (workspace.logoUrl != null) {
      await _storage.write(key: _kWorkspaceLogoUrl, value: workspace.logoUrl);
    } else {
      await _storage.delete(key: _kWorkspaceLogoUrl);
    }
    await _storage.write(key: _kRememberedEmail, value: email);
  }

  /// Clears the auth token only.
  Future<void> clear() => _storage.delete(key: _kToken);

  /// Clears the token and everything remembered about the workspace/email —
  /// used on an explicit logout so the next login starts from the email step.
  Future<void> clearAll() async {
    await _storage.delete(key: _kToken);
    await _storage.delete(key: _kWorkspaceSlug);
    await _storage.delete(key: _kWorkspaceName);
    await _storage.delete(key: _kWorkspaceLogoUrl);
    await _storage.delete(key: _kRememberedEmail);
  }
}

final tokenStorageProvider = Provider<TokenStorage>(
  (ref) => TokenStorage(
    const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
    ),
  ),
);
