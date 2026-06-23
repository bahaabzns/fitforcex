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

  // Training Mode (pushed full-screen over the shell)
  static const trainingSession = '/training/session';
  static const trainingHistory = '/training/history';
  static const trainingProgress = '/training/progress';
  static String trainingHistoryDetail(String id) => '/training/history/$id';

  // Forms
  static String formFill(String id) => '/forms/$id';

  // Top-bar destinations (pushed over the shell)
  static const profile = '/profile';
  static const notifications = '/notifications';
}
