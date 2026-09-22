import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../theme/app_theme.dart';

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

/// A first-time-only floating hint that anchors to [child], shown once ever
/// per install (shared_preferences-backed) and dismissed via its own "got
/// it" button. Port of web's `NewFeatureTooltip` (a HeroUI `Popover`) —
/// same anchored-bubble-with-arrow shape, built on
/// [CompositedTransformFollower] instead of an Overlay-wide barrier.
///
/// [child] always renders regardless of hint state — this widget only adds
/// a floating bubble beside it while the hint is active and unseen. Like
/// web's `isNonModal` popover, there is no tap-outside-to-dismiss scrim: the
/// bubble is exactly as big as its own content, so it never captures taps
/// meant for anything else on screen (an earlier attempt at this used a
/// full-screen barrier and intercepted taps meant for other controls — see
/// the mobile port commit for `f73765a`). Dismiss it explicitly, or call
/// `ref.read(featureHintSeenProvider(featureKey).notifier).dismiss()` from
/// the anchored control's own `onTap` for web's "using the feature dismisses
/// the hint" behavior.
///
/// ```dart
/// NewFeatureHint(
///   featureKey: 'resume_session_hint',
///   active: _activeSession != null,
///   message: l10n.trainingResumeSessionHint,
///   dismissLabel: l10n.trainingResumeSessionHintDismiss,
///   badgeLabel: l10n.trainingResumeSessionNewFeature,
///   child: _ContinueTrigger(...),
/// )
/// ```
class NewFeatureHint extends ConsumerStatefulWidget {
  const NewFeatureHint({
    super.key,
    required this.featureKey,
    required this.active,
    required this.message,
    required this.dismissLabel,
    required this.badgeLabel,
    required this.child,
    this.preferBelow = true,
  });

  final String featureKey;
  final bool active;
  final String message;
  final String dismissLabel;
  final String badgeLabel;
  final Widget child;

  /// Which side of [child] the bubble opens on when there's room either way.
  /// Flips automatically when the preferred side is too tight against the
  /// screen edge.
  final bool preferBelow;

  @override
  ConsumerState<NewFeatureHint> createState() => _NewFeatureHintState();
}

class _NewFeatureHintState extends ConsumerState<NewFeatureHint> {
  final LayerLink _link = LayerLink();
  final GlobalKey _targetKey = GlobalKey();
  OverlayEntry? _entry;
  bool _shown = false;

  @override
  void didUpdateWidget(covariant NewFeatureHint oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.active) _remove();
  }

  @override
  void dispose() {
    _remove();
    super.dispose();
  }

  void _remove() {
    _entry?.remove();
    _entry = null;
  }

  void _dismiss() {
    unawaited(ref.read(featureHintSeenProvider(widget.featureKey).notifier).dismiss());
    _remove();
  }

  void _show() {
    if (_entry != null || !mounted) return;
    final box = _targetKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;

    final targetSize = box.size;
    final targetTopLeft = box.localToGlobal(Offset.zero);
    final screen = MediaQuery.sizeOf(context);
    // Insets for the status bar, notches, and gesture/nav bar — clamping to
    // the raw screen edges instead leaves the bubble sitting under a notch
    // or the system nav bar, which reads as "cut off" just as much as
    // actually running past the edge.
    final viewPadding = MediaQuery.paddingOf(context);
    const edgePadding = 12.0;
    const gap = 8.0;
    // Room a compact 1-2 line bubble actually needs on its preferred side
    // before it's worth flipping to the other side at all.
    const minPreferredRoom = 90.0;
    const minBubbleHeight = 60.0;

    final safeLeft = viewPadding.left + edgePadding;
    final safeRight = screen.width - viewPadding.right - edgePadding;
    final safeTop = viewPadding.top + edgePadding;
    final safeBottom = screen.height - viewPadding.bottom - edgePadding;
    final bubbleWidth = math.min(260.0, math.max(0.0, safeRight - safeLeft));

    final spaceAbove = targetTopLeft.dy - safeTop;
    final spaceBelow = safeBottom - (targetTopLeft.dy + targetSize.height);
    // Stick to the preferred side as long as it has *reasonable* room —
    // only flip when the preferred side is genuinely too tight AND the
    // other side is actually better. Comparing "preferred vs. other" and
    // flipping whenever the other side merely happens to be bigger (the
    // previous version of this check) defeats `preferBelow` entirely for
    // any anchor with more room on its non-preferred side, which is the
    // common case for an icon near the top of a card.
    final preferredSpace = widget.preferBelow ? spaceBelow : spaceAbove;
    final otherSpace = widget.preferBelow ? spaceAbove : spaceBelow;
    final flip = preferredSpace < minPreferredRoom && otherSpace > preferredSpace;
    final below = widget.preferBelow ? !flip : flip;
    // Whichever side got picked, the bubble must still fit within it — cap
    // its height rather than letting it run past the top/bottom edge. A
    // message that's too long to fit even this floor scrolls internally
    // instead (see _HintBubble) rather than reverting to an overflow.
    final maxHeight = math.max(minBubbleHeight, (below ? spaceBelow : spaceAbove) - gap);

    // Anchor the bubble centered on the target by default (targetAnchor /
    // followerAnchor both x:0 — each widget's own horizontal center), then
    // nudge it sideways with a plain pixel offset only if that would run it
    // off the screen. The arrow is drawn at the target's true center in the
    // bubble's *own* coordinate space, so it still points at the target
    // correctly even after the nudge — a fixed left/center/right alignment
    // preset can't do that for a target much narrower than the bubble
    // (e.g. a small icon near a screen edge) without drifting off-target.
    final anchorCenterX = targetTopLeft.dx + targetSize.width / 2;
    final idealLeft = anchorCenterX - bubbleWidth / 2;
    final maxLeft = math.max(safeLeft, safeRight - bubbleWidth);
    final clampedLeft = idealLeft.clamp(safeLeft, maxLeft);
    final horizontalShift = clampedLeft - idealLeft;
    const arrowWidth = 14.0;
    final arrowLocalX = (bubbleWidth / 2 - horizontalShift)
        .clamp(edgePadding + arrowWidth / 2, bubbleWidth - edgePadding - arrowWidth / 2);

    _entry = OverlayEntry(
      builder: (_) => CompositedTransformFollower(
        link: _link,
        showWhenUnlinked: false,
        targetAnchor: Alignment(0, below ? 1 : -1),
        followerAnchor: Alignment(0, below ? -1 : 1),
        offset: Offset(horizontalShift, below ? gap : -gap),
        child: _HintBubble(
          message: widget.message,
          dismissLabel: widget.dismissLabel,
          badgeLabel: widget.badgeLabel,
          arrowLocalX: arrowLocalX,
          arrowDown: !below,
          width: bubbleWidth,
          maxHeight: maxHeight,
          onDismiss: _dismiss,
        ),
      ),
    );
    Overlay.of(context, rootOverlay: true).insert(_entry!);
  }

  @override
  Widget build(BuildContext context) {
    final seen = ref.watch(featureHintSeenProvider(widget.featureKey));
    final wantsShown = widget.active && seen == false;

    if (wantsShown && !_shown) {
      _shown = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _show();
      });
    } else if (!wantsShown && _shown) {
      _shown = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _remove();
      });
    }

    return CompositedTransformTarget(
      link: _link,
      child: KeyedSubtree(key: _targetKey, child: widget.child),
    );
  }
}

class _HintBubble extends StatelessWidget {
  const _HintBubble({
    required this.message,
    required this.dismissLabel,
    required this.badgeLabel,
    required this.arrowLocalX,
    required this.arrowDown,
    required this.width,
    required this.maxHeight,
    required this.onDismiss,
  });

  final String message;
  final String dismissLabel;
  final String badgeLabel;

  /// Where the arrow's tip sits, in pixels from the bubble's own left edge —
  /// the target's true screen center translated into the bubble's local
  /// coordinate space (see the comment in `_show()`), not a left/center/right
  /// preset.
  final double arrowLocalX;
  final bool arrowDown;
  final double width;

  /// Total room actually available on the chosen side, computed in `_show()`
  /// — the whole bubble (card + arrow) is capped to this so it can never run
  /// past the screen edge; a message that doesn't fit scrolls internally.
  final double maxHeight;
  final VoidCallback onDismiss;

  static const _arrowSize = Size(14, 7);

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final primary = Theme.of(context).colorScheme.primary;
    final surface = Theme.of(context).colorScheme.surface;
    final card = Container(
      width: width,
      constraints: BoxConstraints(maxHeight: math.max(0.0, maxHeight - _arrowSize.height)),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      // Scrolls internally rather than overflowing — the height cap above
      // is real screen room, and an unusually long message should shrink
      // to fit it rather than spill past whatever edge it was capped for.
      child: SingleChildScrollView(
        child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Everything except the dismiss link ignores pointer events —
          // anchors that live inside a dense scrollable list (an exercise
          // row's Instructions icon, a history card's delete icon) can end
          // up with the bubble overlapping *other* interactive rows below
          // it, and this content has nothing of its own to tap anyway. Only
          // the explicit "got it" link stays live, matching web's popover
          // (one clickable dismiss action, the rest inert copy).
          IgnorePointer(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (badgeLabel.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.celebration, size: 12, color: primary),
                        const SizedBox(width: 4),
                        Text(
                          badgeLabel.toUpperCase(),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.3,
                            color: primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),
                ],
                Text(message, style: const TextStyle(fontSize: 12.5, height: 1.35)),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: GestureDetector(
              onTap: onDismiss,
              child: Text(
                dismissLabel,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: primary,
                ),
              ),
            ),
          ),
        ],
        ),
      ),
    );
    // A Stack (not a Column+Align) so every box here has a bounded size —
    // this widget sits directly under an OverlayEntry, which hands out
    // effectively unbounded constraints, and an unconstrained Align in that
    // position renders nothing at all instead of erroring loudly.
    return Material(
      type: MaterialType.transparency,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Padding(
            padding: EdgeInsets.only(
              top: arrowDown ? 0 : _arrowSize.height,
              bottom: arrowDown ? _arrowSize.height : 0,
            ),
            child: card,
          ),
          Positioned(
            left: (arrowLocalX - _arrowSize.width / 2)
                .clamp(0.0, width - _arrowSize.width),
            top: arrowDown ? null : 0,
            bottom: arrowDown ? 0 : null,
            child: CustomPaint(
              size: _arrowSize,
              painter: _ArrowPainter(
                  color: surface, borderColor: colors.border, pointDown: arrowDown),
            ),
          ),
        ],
      ),
    );
  }
}

class _ArrowPainter extends CustomPainter {
  const _ArrowPainter({required this.color, required this.borderColor, required this.pointDown});

  final Color color;
  final Color borderColor;
  final bool pointDown;

  @override
  void paint(Canvas canvas, Size size) {
    final tipY = pointDown ? size.height : 0.0;
    final baseY = pointDown ? 0.0 : size.height;
    final path = Path()
      ..moveTo(0, baseY)
      ..lineTo(size.width / 2, tipY)
      ..lineTo(size.width, baseY);
    canvas.drawPath(
      path,
      Paint()
        ..color = borderColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
    canvas.drawPath(
      Path()
        ..moveTo(0, baseY + (pointDown ? -1 : 1) * math.min(1, size.height))
        ..lineTo(size.width / 2, tipY)
        ..lineTo(size.width, baseY + (pointDown ? -1 : 1) * math.min(1, size.height))
        ..close(),
      Paint()..color = color,
    );
  }

  @override
  bool shouldRepaint(covariant _ArrowPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.borderColor != borderColor || oldDelegate.pointDown != pointDown;
}
