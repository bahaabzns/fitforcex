import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../../shared/models/insight_prompt.dart';

/// Answer a prompt gave to `onSubmit` — mirrors the shape
/// `InsightsRepository.respondToPrompt` expects.
typedef PromptAnswer = ({int? ratingValue, String? selectedOption, String? textValue});

/// Pure presentational card for one [InsightPrompt] — the question UI shared
/// by the global banner (manual/immediate prompts) and the inline contextual
/// banners (trigger-event prompts). Port of the web `PromptCard.js`.
class PromptCard extends StatefulWidget {
  const PromptCard({
    super.key,
    required this.prompt,
    required this.onSubmit,
    required this.onDismiss,
    required this.onStart,
    required this.submitting,
    required this.thanked,
  });

  final InsightPrompt prompt;
  final ValueChanged<PromptAnswer> onSubmit;
  final VoidCallback onDismiss;
  final VoidCallback onStart;
  final bool submitting;
  final bool thanked;

  @override
  State<PromptCard> createState() => _PromptCardState();
}

class _PromptCardState extends State<PromptCard> {
  int? _rating;
  String? _selectedOption;
  final _textController = TextEditingController();
  bool _started = false;

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  void _markStarted() {
    if (_started) return;
    _started = true;
    widget.onStart();
  }

  bool get _canSubmit {
    final type = widget.prompt.responseType;
    return (type == 'rating' && _rating != null) ||
        (type == 'rating_with_text' && _rating != null) ||
        (type == 'multiple_choice' && _selectedOption != null) ||
        (type == 'text' && _textController.text.trim().isNotEmpty);
  }

  void _handleSubmit() {
    final type = widget.prompt.responseType;
    final isRating = type == 'rating' || type == 'rating_with_text';
    final text = _textController.text.trim();
    widget.onSubmit((
      ratingValue: isRating ? _rating : null,
      selectedOption: type == 'multiple_choice' ? _selectedOption : null,
      textValue: type == 'text'
          ? text
          : (type == 'rating_with_text' && text.isNotEmpty ? text : null),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final primary = Theme.of(context).colorScheme.primary;

    if (widget.thanked) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Text(l10n.insightsBannerThanks,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14)),
      );
    }

    final type = widget.prompt.responseType;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.insightsBannerQuickQuestion.toUpperCase(),
                    style: TextStyle(
                        fontSize: 10, fontWeight: FontWeight.w600, color: muted),
                  ),
                  const SizedBox(height: 2),
                  Text(widget.prompt.questionEn,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
            IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              visualDensity: VisualDensity.compact,
              onPressed: widget.onDismiss,
              icon: Icon(Icons.close, size: 16, color: muted),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (type == 'rating' || type == 'rating_with_text')
          Wrap(
            spacing: 4,
            runSpacing: 4,
            children: [
              for (var n = 1; n <= widget.prompt.scaleMax; n++)
                _RatingChip(
                  value: n,
                  selected: _rating == n,
                  primary: primary,
                  onTap: () {
                    _markStarted();
                    setState(() => _rating = n);
                  },
                ),
            ],
          ),
        if (type == 'rating_with_text') ...[
          const SizedBox(height: 8),
          TextField(
            controller: _textController,
            onChanged: (_) {
              _markStarted();
              setState(() {});
            },
            maxLines: 2,
            decoration: InputDecoration(
              hintText: l10n.insightsBannerOptionalNote,
              isDense: true,
            ),
          ),
        ],
        if (type == 'multiple_choice' && widget.prompt.options != null)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final opt in widget.prompt.options!)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () {
                      _markStarted();
                      setState(() => _selectedOption = opt);
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: _selectedOption == opt
                              ? primary
                              : context.appColors.border,
                        ),
                        color: _selectedOption == opt
                            ? primary.withValues(alpha: 0.1)
                            : null,
                      ),
                      child: Text(opt, style: const TextStyle(fontSize: 13)),
                    ),
                  ),
                ),
            ],
          ),
        if (type == 'text')
          TextField(
            controller: _textController,
            onChanged: (_) {
              _markStarted();
              setState(() {});
            },
            maxLines: 2,
            decoration: const InputDecoration(isDense: true),
          ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            TextButton(
              onPressed: widget.submitting ? null : widget.onDismiss,
              child: Text(l10n.insightsBannerDismiss),
            ),
            const SizedBox(width: 4),
            FilledButton(
              // See form_fill_page.dart's Save button for why this override
              // is needed: the theme's FilledButton default is full-width.
              style: FilledButton.styleFrom(minimumSize: const Size(64, 36)),
              onPressed:
                  (!_canSubmit || widget.submitting) ? null : _handleSubmit,
              child: Text(l10n.insightsBannerSubmit),
            ),
          ],
        ),
      ],
    );
  }
}

class _RatingChip extends StatelessWidget {
  const _RatingChip({
    required this.value,
    required this.selected,
    required this.primary,
    required this.onTap,
  });

  final int value;
  final bool selected;
  final Color primary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          color: selected ? primary : null,
          border: Border.all(
              color: selected ? primary : context.appColors.border),
        ),
        child: Text(
          '$value',
          style: TextStyle(
            fontSize: 12,
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
