import 'package:flutter/material.dart';

import '../../../core/auth/workspace.dart';
import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import 'workspace_logo.dart';

/// Step shown only when the same email matches clients at more than one
/// workspace: the client picks which one to sign in to, by branding, never
/// by a raw slug.
class LoginWorkspacePickerStep extends StatelessWidget {
  const LoginWorkspacePickerStep({
    super.key,
    required this.workspaces,
    required this.onSelect,
    required this.onBack,
  });

  final List<Workspace> workspaces;
  final ValueChanged<Workspace> onSelect;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;

    return Column(
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
        Text(
          l10n.loginWorkspacePickerTitle,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          l10n.loginWorkspacePickerHint,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: muted),
        ),
        const SizedBox(height: 20),
        for (final workspace in workspaces)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _WorkspaceTile(
              workspace: workspace,
              onTap: () => onSelect(workspace),
            ),
          ),
      ],
    );
  }
}

class _WorkspaceTile extends StatelessWidget {
  const _WorkspaceTile({required this.workspace, required this.onTap});
  final Workspace workspace;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: colors.border),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              WorkspaceLogo(name: workspace.name, logoUrl: workspace.logoUrl),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      workspace.name,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    if (workspace.clientName?.isNotEmpty ?? false)
                      Text(
                        workspace.clientName!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: colors.mutedForeground,
                            ),
                      ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: colors.mutedForeground),
            ],
          ),
        ),
      ),
    );
  }
}
