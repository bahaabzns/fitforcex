import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import 'login_error_banner.dart';

final RegExp _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

/// Step 1 of the email-first login flow: just an email field. The client
/// never sees or enters a workspace slug — the backend resolves it from the
/// email on submit.
class LoginEmailStep extends StatelessWidget {
  const LoginEmailStep({
    super.key,
    required this.formKey,
    required this.emailController,
    required this.submitting,
    required this.error,
    required this.onContinue,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController emailController;
  final bool submitting;
  final String? error;
  final VoidCallback onContinue;

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
          Text(
            l10n.loginEmailStepTitle,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.loginEmailStepHint,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: muted),
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: emailController,
            autofocus: true,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.email],
            decoration: InputDecoration(labelText: l10n.loginEmailLabel),
            onFieldSubmitted: (_) => onContinue(),
            validator: (v) {
              final value = v?.trim() ?? '';
              if (value.isEmpty) return l10n.loginEmailRequired;
              if (!_emailPattern.hasMatch(value)) return l10n.loginEmailInvalid;
              return null;
            },
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            LoginErrorBanner(message: error!),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: submitting ? null : onContinue,
            child: Text(submitting ? l10n.loginCheckingEmail : l10n.loginContinue),
          ),
        ],
      ),
    );
  }
}
