/// The single place that reads build-time configuration.
///
/// Values arrive via `--dart-define` (see `.env.example`). Nothing else in the
/// app should read `String.fromEnvironment` — depend on [AppConfig] instead.
library;

import 'package:flutter/foundation.dart' show kReleaseMode;

enum Flavor { dev, staging, prod }

class AppConfig {
  const AppConfig({
    required this.apiBaseUrl,
    required this.flavor,
    required this.defaultWorkspaceSlug,
  });

  /// API origin without a trailing slash. The app appends `/api/client-portal/*`.
  final String apiBaseUrl;
  final Flavor flavor;

  /// Dev-only convenience: prefill the workspace field on login.
  final String defaultWorkspaceSlug;

  bool get isDev => flavor == Flavor.dev;
  bool get isProd => flavor == Flavor.prod;

  /// Base path every client-portal endpoint hangs off.
  String get clientPortalBase => '$apiBaseUrl/api/client-portal';

  static AppConfig fromEnvironment() {
    const rawBase = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://10.0.2.2:5000',
    );
    const rawFlavor = String.fromEnvironment('FLAVOR', defaultValue: 'dev');
    const slug = String.fromEnvironment('DEFAULT_WORKSPACE_SLUG');

    final config = AppConfig(
      apiBaseUrl: _stripTrailingSlash(rawBase),
      flavor: _parseFlavor(rawFlavor),
      defaultWorkspaceSlug: slug,
    );

    // A release build with no --dart-define silently falls back to the
    // dev/emulator config above (FLAVOR=dev, API_BASE_URL=10.0.2.2) instead
    // of failing to compile. Refuse to launch rather than ship that quietly.
    // A deliberate FLAVOR=staging release (e.g. an internal-testers build) is
    // fine and not blocked — only the unconfigured default is.
    // See mobile/env.prod.json and the "Release signing" section of README.
    if (kReleaseMode && config.flavor == Flavor.dev) {
      throw StateError(
        'Release build is missing --dart-define-from-file=env.prod.json — '
        'it would ship pointed at "$rawBase" (flavor: $rawFlavor).',
      );
    }

    return config;
  }

  static String _stripTrailingSlash(String url) =>
      url.endsWith('/') ? url.substring(0, url.length - 1) : url;

  static Flavor _parseFlavor(String value) {
    switch (value.toLowerCase()) {
      case 'prod':
        return Flavor.prod;
      case 'staging':
        return Flavor.staging;
      default:
        return Flavor.dev;
    }
  }
}
