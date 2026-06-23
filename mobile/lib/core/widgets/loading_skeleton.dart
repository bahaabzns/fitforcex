import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// A single shimmering placeholder block — the parallel of HeroUI's `Skeleton`.
class SkeletonBox extends StatefulWidget {
  const SkeletonBox({
    super.key,
    this.height = 16,
    this.width,
    this.borderRadius = 12,
  });

  final double height;
  final double? width;
  final double borderRadius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = context.appColors.secondary;
    final highlight = context.appColors.border;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Container(
          height: widget.height,
          width: widget.width,
          decoration: BoxDecoration(
            color: Color.lerp(base, highlight, _controller.value),
            borderRadius: BorderRadius.circular(widget.borderRadius),
          ),
        );
      },
    );
  }
}

/// A simple stacked-card skeleton list used while a screen's data loads.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.itemCount = 3, this.itemHeight = 72});

  final int itemCount;
  final double itemHeight;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SkeletonBox(height: 28, width: 180),
          const SizedBox(height: 24),
          for (var i = 0; i < itemCount; i++) ...[
            SkeletonBox(height: itemHeight, borderRadius: 16),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}
