import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../../shared/utils/localization.dart';

/// Read-only coach instructions for one exercise, opened from the
/// `Coach Note` icon on the logging card. Same draggable-sheet shell as
/// [ExerciseInsightsModal] — there's no text input here, so (unlike
/// [ExerciseNotesModal]) there's no keyboard-inset handling to worry about.
class CoachNoteModal extends StatelessWidget {
  const CoachNoteModal({
    super.key,
    required this.instructionsEn,
    required this.instructionsAr,
  });

  final String? instructionsEn;
  final String? instructionsAr;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final note = localizedField(
      base: instructionsEn ?? '',
      arabic: instructionsAr,
      localeCode: locale,
    ).trim();

    return DraggableScrollableSheet(
      initialChildSize: 0.5,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.trainingCoachNote,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          Expanded(
            child: note.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Text(
                        l10n.trainingNoCoachNote,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            color: context.appColors.mutedForeground),
                      ),
                    ),
                  )
                : ListView(
                    controller: scrollController,
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                    children: [
                      Row(
                        children: [
                          Icon(Icons.menu_book_outlined,
                              size: 16, color: context.appColors.mutedForeground),
                          const SizedBox(width: 6),
                          Text(
                            l10n.trainingCoachInstructions,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: context.appColors.mutedForeground,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(note,
                          style: const TextStyle(fontSize: 13, height: 1.5)),
                    ],
                  ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                FilledButton(
                  onPressed: () => Navigator.pop(context),
                  style: FilledButton.styleFrom(minimumSize: Size.zero),
                  child: Text(l10n.commonClose),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
