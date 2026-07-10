import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persisted "have I seen this?" state backing the bottom-nav unread dots.
/// Shared by every module (Nutrition/Training/Forms) instead of each one
/// inventing its own storage — the only two shapes any of them need are
/// "one identity key" (a plan) or "a set of ids" (form requests). Survives
/// app restart by design (backed by shared_preferences, same as the rest of
/// the app's local persistence — see AccessCache/LocaleController).
class LastSeenStore {
  Future<String?> getPlanKey(String module) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('last_seen_plan_$module');
  }

  Future<void> setPlanKey(String module, String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('last_seen_plan_$module', key);
  }

  Future<Set<String>> getSeenIds(String module) async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList('last_seen_ids_$module') ?? const []).toSet();
  }

  Future<void> setSeenIds(String module, Set<String> ids) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('last_seen_ids_$module', ids.toList());
  }
}

final lastSeenStoreProvider = Provider<LastSeenStore>((ref) => LastSeenStore());
