/// Centralised route paths so navigation never hardcodes strings.
class AppRoutes {
  AppRoutes._();

  static const splash = '/splash';
  static const login = '/login';

  // Bottom-tab branches
  static const home = '/home';
  static const nutrition = '/nutrition';
  static const training = '/training';
  static const forms = '/forms';
  static const messages = '/messages';

  // Top-bar destinations (pushed over the shell)
  static const profile = '/profile';
  static const notifications = '/notifications';
}
