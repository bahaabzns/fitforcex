import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// A workspace's logo, or an initial-letter fallback when there's no logo
/// (the branding fields aren't modelled server-side yet) or the image fails
/// to load. Plain [Image.network] — the picker is a rare path, not worth
/// pulling in an image-caching package for.
class WorkspaceLogo extends StatelessWidget {
  const WorkspaceLogo({
    super.key,
    required this.name,
    this.logoUrl,
    this.size = 40,
  });

  final String name;
  final String? logoUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    final url = logoUrl;

    return ClipRRect(
      borderRadius: BorderRadius.circular(size / 3.5),
      child: SizedBox(
        width: size,
        height: size,
        child: (url != null && url.isNotEmpty)
            ? Image.network(
                url,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _fallback(colors, initial),
              )
            : _fallback(colors, initial),
      ),
    );
  }

  Widget _fallback(AppSemanticColors colors, String initial) {
    return Container(
      color: colors.secondary,
      alignment: Alignment.center,
      child: Text(
        initial,
        style: TextStyle(
          fontSize: size * 0.4,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
