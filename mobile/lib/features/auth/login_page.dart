import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/auth_state.dart';
import '../../core/auth/token_storage.dart';
import '../../core/config/app_config.dart';
import '../../core/config/providers.dart';
import '../../core/network/api_exception.dart';
import '../../l10n/generated/app_localizations.dart';

/// Workspace + credentials login. The mobile parallel of the web portal login,
/// but the workspace is entered explicitly (no subdomain on mobile — plan §4).
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

  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_prefillWorkspace());
  }

  Future<void> _prefillWorkspace() async {
    final stored = await ref.read(tokenStorageProvider).readWorkspaceSlug();
    final AppConfig config = ref.read(appConfigProvider);
    final initial = stored ?? config.defaultWorkspaceSlug;
    if (initial.isNotEmpty && mounted) _workspace.text = initial;

    // Surface a session-expired message routed in from a global 401.
    final auth = ref.read(authControllerProvider);
    if (auth is Unauthenticated && auth.message != null && mounted) {
      setState(() => _error = auth.message);
    }
  }

  @override
  void dispose() {
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
            email: _email.text.trim(),
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
                      l10n.loginTitle,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
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
                      obscureText: true,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.password],
                      onFieldSubmitted: (_) => _submit(),
                      decoration:
                          InputDecoration(labelText: l10n.loginPasswordLabel),
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
