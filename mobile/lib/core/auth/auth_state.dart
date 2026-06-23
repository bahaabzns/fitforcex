import 'client.dart';

/// Session state machine: `unknown` (still checking) → `authenticated` |
/// `unauthenticated`. The router redirects off of this.
sealed class AuthState {
  const AuthState();
}

class AuthUnknown extends AuthState {
  const AuthUnknown();
}

class Authenticated extends AuthState {
  const Authenticated(this.client);
  final Client client;
}

class Unauthenticated extends AuthState {
  const Unauthenticated({this.message});

  /// Optional reason (e.g. session expired) to surface on the login screen.
  final String? message;
}

extension AuthStateX on AuthState {
  bool get isAuthenticated => this is Authenticated;
  bool get isUnknown => this is AuthUnknown;
  Client? get clientOrNull =>
      this is Authenticated ? (this as Authenticated).client : null;
}
