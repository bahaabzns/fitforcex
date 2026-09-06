import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persisted "has this one-time feature hint been dismissed?" flag — the
/// mobile parallel of web's `NewFeatureTooltip`'s `ff_seen_feature_hint_*`
/// localStorage keys. One flag per featureKey, forever (never re-shown once
/// dismissed). `null` means "not loaded yet" — distinct from `false`
/// ("loaded, genuinely never seen") so a caller can tell the two apart.
class FeatureHintSeenController extends FamilyNotifier<bool?, String> {
  bool _disposed = false;
  // Guards against the async storage read resolving *after* dismiss() has
  // already set a fresher value — without this, a slow-to-load persisted
  // value could clobber a dismissal the user just made.
  bool _loaded = false;

  @override
  bool? build(String arg) {
    ref.onDispose(() => _disposed = true);
    unawaited(_load(arg));
    return null;
  }

  Future<void> _load(String featureKey) async {
    final prefs = await SharedPreferences.getInstance();
    final seen = prefs.getBool('ff_seen_feature_hint_$featureKey') ?? false;
    if (!_disposed && !_loaded) {
      _loaded = true;
      state = seen;
    }
  }

  Future<void> dismiss() async {
    _loaded = true;
    if (state == true) return;
    state = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('ff_seen_feature_hint_$arg', true);
  }
}

final featureHintSeenProvider =
    NotifierProvider.family<FeatureHintSeenController, bool?, String>(
        FeatureHintSeenController.new);

/// Shows a first-time-only hint for [featureKey] as a SnackBar, once ever per
/// install. Port of web's `NewFeatureTooltip` — an anchored floating popover
/// there, a SnackBar here: mobile's native idiom for an ephemeral "here's
/// something new" tip, and it sidesteps the layout fragility a custom
/// Overlay-anchored callout would have next to an AppBar/list row.
///
/// Call on every `build()`, passing back the caller-owned [alreadyShown]
/// flag (a plain `bool` field on the caller's State) each time — this
/// function is a no-op once it has fired, even if [active] later flips back
/// on (e.g. a resumable session appearing/disappearing), and returns the
/// flag's new value for the caller to store:
/// ```dart
/// _resumeHintShown = maybeShowFeatureHint(context, ref,
///     featureKey: 'resume_session_hint', active: _activeSession != null,
///     alreadyShown: _resumeHintShown, message: ..., dismissLabel: ..., badgeLabel: ...);
/// ```
bool maybeShowFeatureHint(
  BuildContext context,
  WidgetRef ref, {
  required String featureKey,
  required bool active,
  required bool alreadyShown,
  required String message,
  required String dismissLabel,
  required String badgeLabel,
}) {
  if (!active || alreadyShown) return alreadyShown;
  // Reactively re-runs this build once the persisted flag finishes loading.
  final seen = ref.watch(featureHintSeenProvider(featureKey));
  if (seen != false) return alreadyShown;

  WidgetsBinding.instance.addPostFrameCallback((_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              badgeLabel.toUpperCase(),
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(height: 2),
            Text(message),
          ],
        ),
        duration: const Duration(seconds: 6),
        // Floating + a tall bottom margin, rather than the default
        // full-width bar glued to the Scaffold's bottom edge — several of
        // this hint's trigger sites (the day-preview's floating
        // Start/Continue pill) live in that exact strip, and a docked
        // SnackBar would sit on top of and block the very control the hint
        // is pointing at.
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 100),
        action: SnackBarAction(
          label: dismissLabel,
          onPressed: () => unawaited(ref
              .read(featureHintSeenProvider(featureKey).notifier)
              .dismiss()),
        ),
      ),
    );
  });
  return true;
}
