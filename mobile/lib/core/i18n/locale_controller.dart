import 'dart:async';
import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Supported locales. Arabic drives full RTL via [MaterialApp]'s directionality.
const supportedLocales = [Locale('en'), Locale('ar')];

/// Persisted UI locale. `null` follows the system locale.
class LocaleController extends Notifier<Locale?> {
  static const _key = 'app_locale';

  @override
  Locale? build() {
    unawaited(_load());
    return null;
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_key);
    if (code != null && code.isNotEmpty) {
      state = Locale(code);
    }
  }

  Future<void> setLocale(Locale? locale) async {
    state = locale;
    final prefs = await SharedPreferences.getInstance();
    if (locale == null) {
      await prefs.remove(_key);
    } else {
      await prefs.setString(_key, locale.languageCode);
    }
  }

  bool get isArabic => state?.languageCode == 'ar';
}

final localeControllerProvider =
    NotifierProvider<LocaleController, Locale?>(LocaleController.new);
