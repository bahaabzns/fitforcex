import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Text color tier for an adherence percentage — every adherence surface
/// (diary checklist, diary history) reuses this so a percentage always
/// reads the same color. Adherence is capped at 100 server-side (a client
/// eating past a goal is still fully adherent, not "over"), so only the
/// low end needs a tier. Mirrors web's `utils/adherence.js` -- no shared
/// package across web/mobile exists in this repo, so keep both in sync.
const _adherenceGoodThreshold = 85;
const _adherenceWarningThreshold = 60;

Color adherenceColor(BuildContext context, int? pct) {
  if (pct == null) return context.appColors.mutedForeground;
  if (pct >= _adherenceGoodThreshold) return context.appColors.success;
  if (pct >= _adherenceWarningThreshold) return context.appColors.warning;
  return Theme.of(context).colorScheme.error;
}
