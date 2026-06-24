import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'client_access.dart';

/// Persists the last-known access so the app can render correctly offline.
/// Non-sensitive (just permission flags), so shared_preferences is fine.
class AccessCache {
  static const _key = 'client_access_cache';

  Future<void> save(ClientAccess access) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(access.toJson()));
  }

  Future<ClientAccess?> read() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return null;
    try {
      return ClientAccess.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

final accessCacheProvider = Provider<AccessCache>((ref) => AccessCache());
