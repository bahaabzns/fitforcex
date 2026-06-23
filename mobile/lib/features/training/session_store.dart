import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../shared/models/workout_session.dart';

/// Persists the single in-progress Training Mode session as JSON in
/// shared_preferences — the mobile parallel of the web's localStorage draft.
/// A kill/restart resumes the same day's session.
class SessionStore {
  static const _key = 'ff_training_session';

  Future<WorkoutSession?> read() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return null;
    try {
      return WorkoutSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      // Corrupt draft — drop it rather than trapping the user.
      await prefs.remove(_key);
      return null;
    }
  }

  Future<void> write(WorkoutSession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(session.toJson()));
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

final sessionStoreProvider = Provider<SessionStore>((ref) => SessionStore());
