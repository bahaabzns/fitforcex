import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/auth_state.dart';
import '../../core/auth/token_storage.dart';
import '../../core/auth/workspace.dart';
import '../../core/auth/workspace_repository.dart';
import '../../core/deeplink/deep_link_service.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import 'widgets/login_email_step.dart';
import 'widgets/login_password_step.dart';
import 'widgets/login_workspace_picker_step.dart';

enum _Step { email, picker, password }

/// Trims and lowercases before every network call — the backend also
/// compares case-insensitively (for accounts predating this rule), but
/// normalizing here keeps what's sent and what's remembered consistent.
String _normalizeEmail(String raw) => raw.trim().toLowerCase();

/// Email-first client login: Email → (workspace resolved automatically, or a
/// picker if the email matches more than one workspace) → Password. The
/// client never sees or enters a workspace slug — it's resolved server-side
/// via `POST /client-portal/discover-workspace` and carried internally for
/// the final `POST /client-portal/login` call, which is unchanged.
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _emailFormKey = GlobalKey<FormState>();
  final _passwordFormKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();

  _Step _step = _Step.email;
  List<Workspace> _discoveredWorkspaces = const [];
  Workspace? _selectedWorkspace;
  bool _remembered = false;

  bool _submitting = false;
  bool _obscurePassword = true;
  String? _error;

  /// A workspace slug delivered by a deep link, resolved purely for a
  /// cosmetic "continuing to &lt;workspace&gt;" hint on the email step.
  String? _deepLinkSlug;

  @override
  void initState() {
    super.initState();
    unawaited(_restore());
  }

  Future<void> _restore() async {
    final remembered = await ref.read(tokenStorageProvider).readRememberedLogin();
    final auth = ref.read(authControllerProvider);
    final sessionMessage = auth is Unauthenticated ? auth.message : null;
    if (!mounted) return;

    if (remembered != null) {
      setState(() {
        _step = _Step.password;
        _selectedWorkspace = remembered.workspace;
        _email.text = remembered.email;
        _remembered = true;
        _error = sessionMessage;
      });
    } else if (sessionMessage != null) {
      setState(() => _error = sessionMessage);
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submitEmail() async {
    if (!_emailFormKey.currentState!.validate()) return;
    final l10n = AppLocalizations.of(context);
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final workspaces = await ref
          .read(workspaceRepositoryProvider)
          .discoverByEmail(_normalizeEmail(_email.text));
      if (!mounted) return;
      if (workspaces.isEmpty) {
        setState(() {
          _error = l10n.loginNoAccountFound;
          _submitting = false;
        });
        return;
      }
      setState(() {
        _submitting = false;
        if (workspaces.length == 1) {
          _selectedWorkspace = workspaces.first;
          _step = _Step.password;
        } else {
          _discoveredWorkspaces = workspaces;
          _step = _Step.picker;
        }
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = l10n.loginFailed);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _selectWorkspace(Workspace workspace) {
    setState(() {
      _selectedWorkspace = workspace;
      _step = _Step.password;
      _error = null;
    });
  }

  void _backToEmail() {
    setState(() {
      _step = _Step.email;
      _selectedWorkspace = null;
      _discoveredWorkspaces = const [];
      _remembered = false;
      _error = null;
      _password.clear();
    });
  }

  void _backFromPassword() {
    if (_discoveredWorkspaces.length > 1) {
      setState(() {
        _step = _Step.picker;
        _remembered = false;
        _error = null;
        _password.clear();
      });
    } else {
      _backToEmail();
    }
  }

  Future<void> _submitPassword() async {
    if (!_passwordFormKey.currentState!.validate()) return;
    final workspace = _selectedWorkspace;
    if (workspace == null) return;

    final l10n = AppLocalizations.of(context);
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final email = _normalizeEmail(_email.text);
      await ref.read(authControllerProvider.notifier).login(
            workspaceSlug: workspace.slug,
            email: email,
            password: _password.text,
          );
      await ref.read(tokenStorageProvider).writeRememberedLogin(
            workspace: workspace,
            email: email,
          );
      // Router redirect handles navigation on the authenticated state.
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = l10n.loginFailed);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // A deep link (fitforcex://w/<slug>) brands the email step, cosmetically.
    ref.listen<String?>(pendingWorkspaceSlugProvider, (_, next) {
      if (next != null && next.isNotEmpty && _step == _Step.email) {
        setState(() => _deepLinkSlug = next);
      }
    });

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                switchInCurve: Curves.easeOut,
                switchOutCurve: Curves.easeIn,
                transitionBuilder: (child, animation) => FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0, 0.03),
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                ),
                child: KeyedSubtree(
                  key: ValueKey(_step),
                  child: _buildStep(context),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStep(BuildContext context) {
    switch (_step) {
      case _Step.email:
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_deepLinkSlug != null) _DeepLinkBanner(slug: _deepLinkSlug!),
            LoginEmailStep(
              formKey: _emailFormKey,
              emailController: _email,
              submitting: _submitting,
              error: _error,
              onContinue: _submitEmail,
            ),
          ],
        );
      case _Step.picker:
        return LoginWorkspacePickerStep(
          workspaces: _discoveredWorkspaces,
          onSelect: _selectWorkspace,
          onBack: _backToEmail,
        );
      case _Step.password:
        return LoginPasswordStep(
          formKey: _passwordFormKey,
          workspace: _selectedWorkspace!,
          email: _email.text.trim(),
          passwordController: _password,
          obscurePassword: _obscurePassword,
          onToggleObscure: () =>
              setState(() => _obscurePassword = !_obscurePassword),
          submitting: _submitting,
          error: _error,
          remembered: _remembered,
          onSubmit: _submitPassword,
          onBack: _backFromPassword,
        );
    }
  }
}

/// Cosmetic banner shown above the email field when a `fitforcex://w/<slug>`
/// deep link (`slug`) resolves to a real workspace, so the screen feels
/// branded before the client even types anything.
class _DeepLinkBanner extends ConsumerWidget {
  const _DeepLinkBanner({required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lookup = ref.watch(workspaceLookupProvider(slug));
    return lookup.maybeWhen(
      data: (ws) {
        if (ws == null) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.check_circle, size: 14, color: context.appColors.success),
              const SizedBox(width: 6),
              Text(ws.name, style: TextStyle(fontSize: 12, color: context.appColors.success)),
            ],
          ),
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}
