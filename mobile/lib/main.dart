import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/config/providers.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Read build-time config once, here, and inject it everywhere via override.
  final config = AppConfig.fromEnvironment();

  runApp(
    ProviderScope(
      overrides: [appConfigProvider.overrideWithValue(config)],
      child: const FitForceApp(),
    ),
  );
}
