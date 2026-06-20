import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the bearer token and the selected workspace slug.
///
/// Token lives in the OS keystore/keychain (secure). The workspace slug is the
/// mobile parallel of the web's `localStorage.setItem('portal_slug')`.
class TokenStorage {
  TokenStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const _kToken = 'client_token';
  static const _kWorkspaceSlug = 'workspace_slug';

  Future<String?> readToken() => _storage.read(key: _kToken);
  Future<void> writeToken(String token) =>
      _storage.write(key: _kToken, value: token);
  Future<void> clearToken() => _storage.delete(key: _kToken);

  Future<String?> readWorkspaceSlug() => _storage.read(key: _kWorkspaceSlug);
  Future<void> writeWorkspaceSlug(String slug) =>
      _storage.write(key: _kWorkspaceSlug, value: slug);

  Future<void> clear() async {
    await _storage.delete(key: _kToken);
    // Keep the workspace slug so the next login screen is pre-branded.
  }
}

final tokenStorageProvider = Provider<TokenStorage>(
  (ref) => TokenStorage(
    const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
    ),
  ),
);
