import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../insights_repository.dart';

const _types = ['bug', 'feature_request', 'rating'];

/// The Insights System's passive entry point — a bug/feature/rating report
/// reachable from Profile, never a popup. Port of the web
/// `FeedbackEntryModal.js`.
class FeedbackEntryModal extends ConsumerStatefulWidget {
  const FeedbackEntryModal({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const FeedbackEntryModal(),
    );
  }

  @override
  ConsumerState<FeedbackEntryModal> createState() =>
      _FeedbackEntryModalState();
}

class _FeedbackEntryModalState extends ConsumerState<FeedbackEntryModal> {
  String _type = 'bug';
  final _descriptionController = TextEditingController();
  int? _rating;
  String? _screenshotUrl;
  bool _uploading = false;
  bool _submitting = false;
  String? _error;
  bool _sent = false;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickScreenshot() async {
    final repo = ref.read(insightsRepositoryProvider);
    final file = await repo.pickScreenshot();
    if (file == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      final url = await repo.uploadScreenshot(file);
      if (mounted) setState(() => _screenshotUrl = url);
    } catch (_) {
      // Non-blocking — a failed screenshot upload shouldn't stop the report
      // itself from being submittable.
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (_type == 'rating') {
      if (_rating == null) {
        setState(() => _error = l10n.insightsEntryErrorRatingRequired);
        return;
      }
    } else if (_descriptionController.text.trim().isEmpty) {
      setState(() => _error = l10n.insightsEntryErrorDescriptionRequired);
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(insightsRepositoryProvider).submitInsight(
            sourceType: _type,
            textValue: _type == 'rating'
                ? null
                : _descriptionController.text.trim(),
            ratingValue: _type == 'rating' ? _rating : null,
            screenshotUrl: _screenshotUrl,
          );
      if (mounted) setState(() => _sent = true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e is ApiException
              ? e.message
              : l10n.insightsEntryErrorSubmitFailed;
        });
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: _sent ? _sentView(context, l10n) : _formView(context, l10n, muted),
        ),
      ),
    );
  }

  Widget _sentView(BuildContext context, AppLocalizations l10n) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(l10n.insightsEntrySentTitle,
            style:
                const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Text(l10n.insightsEntrySentBody,
            textAlign: TextAlign.center,
            style: TextStyle(color: context.appColors.mutedForeground)),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () => Navigator.pop(context),
          child: Text(l10n.commonClose),
        ),
      ],
    );
  }

  Widget _formView(BuildContext context, AppLocalizations l10n, Color muted) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.insightsEntryTitle,
            style:
                const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          children: [
            for (final type in _types)
              ChoiceChip(
                label: Text(_typeLabel(l10n, type)),
                selected: _type == type,
                onSelected: (_) => setState(() => _type = type),
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (_type == 'rating') ...[
          Text(l10n.insightsEntryRatingLabel,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (var n = 1; n <= 10; n++)
                _RatingChip(
                  value: n,
                  selected: _rating == n,
                  onTap: () => setState(() => _rating = n),
                ),
            ],
          ),
        ] else ...[
          Text(l10n.insightsEntryDescriptionLabel,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w500)),
          const SizedBox(height: 6),
          TextField(
            controller: _descriptionController,
            maxLines: 4,
            decoration: InputDecoration(
              hintText: l10n.insightsEntryDescriptionPlaceholder,
            ),
          ),
        ],
        if (_type == 'bug') ...[
          const SizedBox(height: 16),
          Text(l10n.insightsEntryScreenshotLabel,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w500)),
          const SizedBox(height: 6),
          if (_screenshotUrl != null)
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(_screenshotUrl!,
                      width: 56, height: 56, fit: BoxFit.cover),
                ),
                const SizedBox(width: 8),
                TextButton.icon(
                  onPressed: () => setState(() => _screenshotUrl = null),
                  icon: const Icon(Icons.close, size: 14),
                  label: Text(l10n.insightsEntryScreenshotRemove),
                ),
              ],
            )
          else
            OutlinedButton(
              onPressed: _uploading ? null : _pickScreenshot,
              child: Text(_uploading
                  ? l10n.insightsEntryScreenshotUploading
                  : l10n.insightsEntryScreenshotAdd),
            ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!,
              style: TextStyle(
                  fontSize: 12, color: Theme.of(context).colorScheme.error)),
        ],
        const SizedBox(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            TextButton(
              onPressed: _submitting ? null : () => Navigator.pop(context),
              child: Text(l10n.commonCancel),
            ),
            const SizedBox(width: 4),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: Text(_submitting
                  ? l10n.insightsEntrySubmitting
                  : l10n.insightsEntrySubmit),
            ),
          ],
        ),
      ],
    );
  }

  String _typeLabel(AppLocalizations l10n, String type) => switch (type) {
        'bug' => l10n.insightsEntryTypeBug,
        'feature_request' => l10n.insightsEntryTypeFeatureRequest,
        _ => l10n.insightsEntryTypeRating,
      };
}

class _RatingChip extends StatelessWidget {
  const _RatingChip(
      {required this.value, required this.selected, required this.onTap});

  final int value;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: selected ? primary : null,
          border: Border.all(
              color: selected ? primary : context.appColors.border),
        ),
        child: Text(
          '$value',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: selected
                ? Theme.of(context).colorScheme.onPrimary
                : context.appColors.mutedForeground,
          ),
        ),
      ),
    );
  }
}
