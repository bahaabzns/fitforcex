import 'package:fitforce_x/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AppConfig', () {
    test('clientPortalBase appends the API path', () {
      const config = AppConfig(
        apiBaseUrl: 'https://api.example.com',
        flavor: Flavor.prod,
        defaultWorkspaceSlug: '',
      );
      expect(
          config.clientPortalBase, 'https://api.example.com/api/client-portal');
    });

    test('flavor flags resolve correctly', () {
      const dev = AppConfig(
        apiBaseUrl: 'x',
        flavor: Flavor.dev,
        defaultWorkspaceSlug: '',
      );
      expect(dev.isDev, isTrue);
      expect(dev.isProd, isFalse);
    });

    test('fromEnvironment falls back to dev defaults', () {
      final config = AppConfig.fromEnvironment();
      expect(config.flavor, Flavor.dev);
      expect(config.apiBaseUrl, isNotEmpty);
      // Base URL must never carry a trailing slash.
      expect(config.apiBaseUrl.endsWith('/'), isFalse);
    });
  });
}
