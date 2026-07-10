import 'package:flutter/material.dart';

/// The FitForce lockup (icon + wordmark) shown centered in the shell's top
/// bar — the mobile parallel of `ClientPortalNav`'s center logo. The icon
/// mark is constant; only the wordmark's color flips with theme brightness
/// (dark wordmark on light surfaces, white wordmark on dark surfaces), same
/// rule as the web (`brand-logo-light`/`brand-logo-dark` in `globals.css`).
/// Source PNGs are `client/public/blue_dark.png` / `blue_white.png` — the
/// same assets the web client portal uses, not the retired "FitForce X" mark.
class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.height = 28});

  final double height;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final devicePixelRatio = MediaQuery.devicePixelRatioOf(context);

    return Semantics(
      label: 'FitForce',
      image: true,
      child: ExcludeSemantics(
        child: Image.asset(
          isDark
              ? 'assets/images/logo_dark_theme.png'
              : 'assets/images/logo_light_theme.png',
          height: height,
          // Source is a fixed-aspect lockup (~3.7:1); let width follow height
          // so it never stretches, and decode at display resolution instead
          // of the full multi-thousand-pixel source for a crisp-but-cheap paint.
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
          cacheHeight: (height * devicePixelRatio).round(),
        ),
      ),
    );
  }
}
