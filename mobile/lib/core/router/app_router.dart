import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/login_page.dart';
import '../../features/forms/form_fill_page.dart';
import '../../features/forms/forms_page.dart';
import '../../features/home/home_page.dart';
import '../../features/messages/messages_page.dart';
import '../../features/notifications/notifications_page.dart';
import '../../features/nutrition/food_diary_history_page.dart';
import '../../features/nutrition/nutrition_page.dart';
import '../../features/profile/profile_page.dart';
import '../../features/profile/subscription_page.dart';
import '../../features/shell/shell_page.dart';
import '../../features/splash/splash_page.dart';
import '../../features/training/history_detail_page.dart';
import '../../features/training/history_page.dart';
import '../../features/training/progress_page.dart';
import '../../features/training/session_complete_page.dart';
import '../../features/training/session_page.dart';
import '../../features/training/training_page.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_state.dart';
import 'app_routes.dart';

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');

/// The app router. Redirects off the auth state machine — the parallel of the
/// web `layout.js` guard that bounces unauthenticated users to the login page.
final routerProvider = Provider<GoRouter>((ref) {
  // Bridge Riverpod → go_router: bump on every auth state change so redirect
  // re-runs. Created once; the Provider itself never rebuilds.
  final refresh = ValueNotifier<int>(0);
  ref.listen<AuthState>(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: AppRoutes.splash,
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final location = state.matchedLocation;

      final atSplash = location == AppRoutes.splash;
      final atLogin = location == AppRoutes.login;

      // Still resolving the session → hold on splash.
      if (auth.isUnknown) return atSplash ? null : AppRoutes.splash;

      if (!auth.isAuthenticated) {
        return atLogin ? null : AppRoutes.login;
      }

      // Authenticated but parked on splash/login → enter the app.
      if (atSplash || atLogin) return AppRoutes.home;
      return null;
    },
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashPage(),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: AppRoutes.profile,
        builder: (context, state) => const ProfilePage(),
      ),
      GoRoute(
        path: AppRoutes.subscription,
        builder: (context, state) => const SubscriptionPage(),
      ),
      GoRoute(
        path: AppRoutes.notifications,
        builder: (context, state) => const NotificationsPage(),
      ),
      GoRoute(
        path: AppRoutes.trainingSession,
        builder: (context, state) {
          final day =
              int.tryParse(state.uri.queryParameters['day'] ?? '0') ?? 0;
          return SessionPage(dayIndex: day);
        },
      ),
      GoRoute(
        path: AppRoutes.trainingSessionComplete,
        builder: (context, state) {
          final q = state.uri.queryParameters;
          return SessionCompletePage(
            dayName: q['dayName'],
            durationSeconds: int.tryParse(q['duration'] ?? ''),
            volume: q['volume'],
            sets: int.tryParse(q['sets'] ?? ''),
          );
        },
      ),
      GoRoute(
        path: AppRoutes.trainingHistory,
        builder: (context, state) => const HistoryPage(),
      ),
      GoRoute(
        path: '/training/history/:id',
        builder: (context, state) =>
            HistoryDetailPage(logId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: AppRoutes.trainingProgress,
        builder: (context, state) => const ProgressPage(),
      ),
      GoRoute(
        path: AppRoutes.nutritionDiary,
        builder: (context, state) => const FoodDiaryHistoryPage(),
      ),
      GoRoute(
        path: '/forms/:id',
        builder: (context, state) =>
            FormFillPage(requestId: state.pathParameters['id']!),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            ShellPage(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                builder: (context, state) => const HomePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.nutrition,
                builder: (context, state) => const NutritionPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.training,
                builder: (context, state) => const TrainingPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.forms,
                builder: (context, state) => const FormsPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.messages,
                builder: (context, state) => const MessagesPage(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
