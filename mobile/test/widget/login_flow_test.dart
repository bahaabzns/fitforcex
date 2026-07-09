import 'package:dio/dio.dart';
import 'package:fitforce_x/core/auth/auth_repository.dart';
import 'package:fitforce_x/core/auth/client.dart';
import 'package:fitforce_x/core/auth/token_storage.dart';
import 'package:fitforce_x/core/auth/workspace.dart';
import 'package:fitforce_x/core/auth/workspace_repository.dart';
import 'package:fitforce_x/core/network/api_exception.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/auth/login_page.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

/// In-memory token storage so the login flow's remember-me behavior can be
/// tested without touching the platform secure-storage channel.
class _FakeTokenStorage extends TokenStorage {
  _FakeTokenStorage() : super(const FlutterSecureStorage());

  String? _token;
  RememberedLogin? _remembered;

  @override
  Future<String?> readToken() async => _token;

  @override
  Future<void> writeToken(String token) async => _token = token;

  @override
  Future<RememberedLogin?> readRememberedLogin() async => _remembered;

  @override
  Future<void> writeRememberedLogin({
    required Workspace workspace,
    required String email,
  }) async {
    _remembered = RememberedLogin(workspace: workspace, email: email);
  }

  @override
  Future<void> clear() async => _token = null;

  @override
  Future<void> clearAll() async {
    _token = null;
    _remembered = null;
  }
}

class _FakeWorkspaceRepository extends WorkspaceRepository {
  _FakeWorkspaceRepository(this._byEmail) : super(Dio());
  final Map<String, List<Workspace>> _byEmail;

  @override
  Future<List<Workspace>> discoverByEmail(String email) async =>
      _byEmail[email.trim().toLowerCase()] ?? const [];
}

class _FakeAuthRepository extends AuthRepository {
  _FakeAuthRepository(TokenStorage tokenStorage) : super(Dio(), tokenStorage);

  String? lastWorkspaceSlug;
  bool shouldFail = false;

  @override
  Future<void> login({
    required String workspaceSlug,
    required String email,
    required String password,
  }) async {
    lastWorkspaceSlug = workspaceSlug;
    if (shouldFail) {
      throw const ApiException(
        message: 'Invalid email or password',
        statusCode: 401,
      );
    }
  }

  @override
  Future<Client> fetchMe() async => const Client(
        id: 'client-1',
        fname: 'Test',
        lname: 'Client',
        email: 'client@test.com',
        workspaceId: 'ws-1',
      );
}

Widget _wrap(
  Widget child, {
  required WorkspaceRepository workspaceRepo,
  required AuthRepository authRepo,
  required TokenStorage tokenStorage,
}) {
  return ProviderScope(
    overrides: [
      workspaceRepositoryProvider.overrideWithValue(workspaceRepo),
      authRepositoryProvider.overrideWithValue(authRepo),
      tokenStorageProvider.overrideWithValue(tokenStorage),
    ],
    child: MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: child,
    ),
  );
}

void main() {
  testWidgets('a unique email skips straight to the password step',
      (tester) async {
    final tokens = _FakeTokenStorage();
    final workspaces = _FakeWorkspaceRepository({
      'client@test.com': [const Workspace(slug: 'acme', name: 'Acme Coaching')],
    });
    final auth = _FakeAuthRepository(tokens);

    await tester.pumpWidget(_wrap(
      const LoginPage(),
      workspaceRepo: workspaces,
      authRepo: auth,
      tokenStorage: tokens,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('Password'), findsNothing);

    await tester.enterText(find.byType(TextFormField).first, 'client@test.com');
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    // The client never sees the slug — only the workspace's display name.
    expect(find.text('Acme Coaching'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.textContaining('acme'), findsNothing);
  });

  testWidgets('an email matching multiple workspaces shows a picker first',
      (tester) async {
    final tokens = _FakeTokenStorage();
    final workspaces = _FakeWorkspaceRepository({
      'shared@test.com': [
        const Workspace(slug: 'gym-a', name: 'Gym A', clientName: 'Sara'),
        const Workspace(slug: 'gym-b', name: 'Gym B', clientName: 'Sara'),
      ],
    });
    final auth = _FakeAuthRepository(tokens);

    await tester.pumpWidget(_wrap(
      const LoginPage(),
      workspaceRepo: workspaces,
      authRepo: auth,
      tokenStorage: tokens,
    ));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).first, 'shared@test.com');
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(find.text('Choose your workspace'), findsOneWidget);
    expect(find.text('Gym A'), findsOneWidget);
    expect(find.text('Gym B'), findsOneWidget);

    await tester.tap(find.text('Gym B'));
    await tester.pumpAndSettle();

    expect(find.text('Gym B'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
  });

  testWidgets('an unknown email shows a friendly error, not a crash',
      (tester) async {
    final tokens = _FakeTokenStorage();
    final workspaces = _FakeWorkspaceRepository(const {});
    final auth = _FakeAuthRepository(tokens);

    await tester.pumpWidget(_wrap(
      const LoginPage(),
      workspaceRepo: workspaces,
      authRepo: auth,
      tokenStorage: tokens,
    ));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).first, 'nobody@test.com');
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(find.textContaining("couldn't find an account"), findsOneWidget);
    expect(find.text('Password'), findsNothing);
  });

  testWidgets(
      'a remembered login skips discovery and opens directly on the password step',
      (tester) async {
    final tokens = _FakeTokenStorage();
    await tokens.writeRememberedLogin(
      workspace: const Workspace(slug: 'acme', name: 'Acme Coaching'),
      email: 'client@test.com',
    );
    final workspaces = _FakeWorkspaceRepository(const {});
    final auth = _FakeAuthRepository(tokens);

    await tester.pumpWidget(_wrap(
      const LoginPage(),
      workspaceRepo: workspaces,
      authRepo: auth,
      tokenStorage: tokens,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.text('client@test.com'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
  });

  testWidgets('successful sign-in sends the internally-resolved slug to login',
      (tester) async {
    final tokens = _FakeTokenStorage();
    final workspaces = _FakeWorkspaceRepository({
      'client@test.com': [const Workspace(slug: 'acme', name: 'Acme Coaching')],
    });
    final auth = _FakeAuthRepository(tokens);

    await tester.pumpWidget(_wrap(
      const LoginPage(),
      workspaceRepo: workspaces,
      authRepo: auth,
      tokenStorage: tokens,
    ));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).first, 'client@test.com');
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).first, 'pass123');
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();

    expect(auth.lastWorkspaceSlug, 'acme');
    final remembered = await tokens.readRememberedLogin();
    expect(remembered?.email, 'client@test.com');
    expect(remembered?.workspace.slug, 'acme');
  });
}
