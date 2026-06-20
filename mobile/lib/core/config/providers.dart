import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_config.dart';

/// Resolved at startup and overridden in `main()` so it's available everywhere.
final appConfigProvider = Provider<AppConfig>(
  (ref) => throw UnimplementedError('appConfigProvider must be overridden in main()'),
);
