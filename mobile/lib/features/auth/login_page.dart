import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/auth_state.dart';
import '../../core/auth/token_storage.dart';
import '../../core/auth/workspace.dart';
import '../../core/auth/workspace_repository.dart';
import '../../core/config/app_config.dart';
import '../../core/config/providers.dart';
import '../../core/deeplink/deep_link_service.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';

/// Workspace + credentials login. The mobile parallel of the web portal login,
/// but the workspace is entered explicitly (no subdomain on mobile — plan §4)
/// and resolved to a branded identity via `GET /client-portal/workspace`.
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _workspace = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();

  /// The slug the workspace-lookup provider watches; updated on a short debounce
  /// so we don't hit the endpoint on every keystroke.
  String _debouncedSlug = '';
  Timer? _debounce;

  bool _submitting = false;
  bool _obscurePassword = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _workspace.addListener(_onWorkspaceChanged);
    unawaited(_prefillWorkspace());
  }

  Future<void> _prefillWorkspace() async {
    final stored = await ref.read(tokenStorageProvider).readWorkspaceSlug();
    final AppConfig config = ref.read(appConfigProvider);
    final initial = stored ?? config.defaultWorkspaceSlug;
    if (initial.isNotEmpty && mounted) {
      _workspace.text = initial;
      setState(() => _debouncedSlug = initial.trim());
    }

    // Surface a session-expired message routed in from a global 401.
    final auth = ref.read(authControllerProvider);
    if (auth is Unauthenticated && auth.message != null && mounted) {
      setState(() => _error = auth.message);
    }
  }

  void _onWorkspaceChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      final next = _workspace.text.trim();
      if (next != _debouncedSlug && mounted) {
        setState(() => _debouncedSlug = next);
      }
    });
  }

  /// Apply a slug delivered by a deep link: fill the field and look it up.
  void _applyDeepLinkSlug(String slug) {
    _workspace.text = slug;
    setState(() => _debouncedSlug = slug);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _workspace.removeListener(_onWorkspaceChanged);
    _workspace.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).login(
            workspaceSlug: _workspace.text.trim(),
            email: _email.text.trim().toLowerCase(),
            password: _password.text,
          );
      // Router redirect handles navigation on the authenticated state.
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizations.of(context).loginFailed);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    // A deep link (fitforcex://w/<slug>) prefills + brands the screen.
    ref.listen<String?>(pendingWorkspaceSlugProvider, (_, next) {
      if (next != null && next.isNotEmpty) _applyDeepLinkSlug(next);
    });

    final slug = _debouncedSlug;
    final lookup =
        slug.isEmpty ? null : ref.watch(workspaceLookupProvider(slug));

    // Brand the heading with the resolved workspace name when available.
    String heading = l10n.loginTitle;
    lookup?.whenData((ws) {
      if (ws != null) heading = ws.name;
    });

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      heading,
                      textAlign: TextAlign.center,
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                    ),
                    const SizedBox(height: 24),
                    TextFormField(
                      controller: _workspace,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: l10n.loginWorkspaceLabel,
                        hintText: l10n.loginWorkspaceHint,
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? l10n.loginWorkspaceRequired
                          : null,
                    ),
                    if (lookup != null) ...[
                      const SizedBox(height: 6),
                      _WorkspaceStatus(lookup: lookup),
                    ],
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      decoration:
                          InputDecoration(labelText: l10n.loginEmailLabel),
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? l10n.loginEmailLabel
                          : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _password,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.password],
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: l10n.loginPasswordLabel,
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                          tooltip: _obscurePassword
                              ? l10n.loginPasswordShow
                              : l10n.loginPasswordHide,
                          onPressed: () => setState(
                            () => _obscurePassword = !_obscurePassword,
                          ),
                        ),
                      ),
                      validator: (v) => (v == null || v.isEmpty)
                          ? l10n.loginPasswordLabel
                          : null,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      _ErrorBanner(message: _error!),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _submitting ? null : _submit,
                      child: Text(
                        _submitting ? l10n.loginSubmitting : l10n.loginSubmit,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Inline status under the workspace field: checking / found (✓ name) / not found.
class _WorkspaceStatus extends StatelessWidget {
  const _WorkspaceStatus({required this.lookup});

  final AsyncValue<Workspace?> lookup;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;

    return lookup.when(
      loading: () => _row(
        const SizedBox(
          width: 12,
          height: 12,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        l10n.loginWorkspaceChecking,
        muted,
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (ws) {
        if (ws == null) {
          return _row(
            Icon(Icons.error_outline,
                size: 14, color: context.appColors.warning),
            l10n.loginWorkspaceNotFound,
            context.appColors.warning,
          );
        }
        return _row(
          Icon(Icons.check_circle, size: 14, color: context.appColors.success),
          ws.name,
          context.appColors.success,
        );
      },
    );
  }

  Widget _row(Widget leading, String text, Color color) {
    return Row(
      children: [
        leading,
        const SizedBox(width: 6),
        Expanded(
          child: Text(text, style: TextStyle(fontSize: 12, color: color)),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.error;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(message, style: TextStyle(color: color))),
        ],
      ),
    );
  }
}
