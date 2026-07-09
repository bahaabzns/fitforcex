import 'package:flutter/material.dart';

import '../../../core/auth/workspace.dart';
import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import 'login_error_banner.dart';
import 'workspace_logo.dart';

/// Final step: workspace branding + email are already known, so this only
/// asks for the password. The slug behind [workspace] is never shown.
class LoginPasswordStep extends StatelessWidget {
  const LoginPasswordStep({
    super.key,
    required this.formKey,
    required this.workspace,
    required this.email,
    required this.passwordController,
    required this.obscurePassword,
    required this.onToggleObscure,
    required this.submitting,
    required this.error,
    required this.remembered,
    required this.onSubmit,
    required this.onBack,
  });

  final GlobalKey<FormState> formKey;
  final Workspace workspace;
  final String email;
  final TextEditingController passwordController;
  final bool obscurePassword;
  final VoidCallback onToggleObscure;
  final bool submitting;
  final String? error;
  final bool remembered;
  final VoidCallback onSubmit;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;

    return Form(
      key: formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton.icon(
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back, size: 18),
              label: Text(l10n.commonBack),
            ),
          ),
          const SizedBox(height: 4),
          Center(
            child: WorkspaceLogo(
              name: workspace.name,
              logoUrl: workspace.logoUrl,
              size: 56,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            remembered ? l10n.loginWelcomeBack : workspace.name,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            email,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: muted),
          ),
          const SizedBox(height: 20),
          TextFormField(
            controller: passwordController,
            autofocus: true,
            obscureText: obscurePassword,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.password],
            onFieldSubmitted: (_) => onSubmit(),
            decoration: InputDecoration(
              labelText: l10n.loginPasswordLabel,
              suffixIcon: IconButton(
                icon: Icon(
                  obscurePassword
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                ),
                tooltip: obscurePassword
                    ? l10n.loginPasswordShow
                    : l10n.loginPasswordHide,
                onPressed: onToggleObscure,
              ),
            ),
            validator: (v) =>
                (v == null || v.isEmpty) ? l10n.loginPasswordLabel : null,
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            LoginErrorBanner(message: error!),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: submitting ? null : onSubmit,
            child: Text(submitting ? l10n.loginSubmitting : l10n.loginSubmit),
          ),
        ],
      ),
    );
  }
}
