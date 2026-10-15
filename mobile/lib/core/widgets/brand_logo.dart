import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../branding/branding_provider.dart';

/// The logo in the shell's top bar — the mobile parallel of `ClientPortalNav`'s center logo.
///
/// Shows the coach's own logo when their branding provides one (their dark-mode variant on dark
/// surfaces, else the same logo), otherwise the FitForce lockup (icon + wordmark). The FitForce
/// icon mark is constant; only its wordmark flips with theme brightness (dark wordmark on light
/// surfaces, white on dark), same rule as the web (`brand-logo-light`/`brand-logo-dark`).
/// Source PNGs are `client/public/blue_dark.png` / `blue_white.png`.
class BrandLogo extends ConsumerWidget {
  const BrandLogo({super.key, this.height = 28});

  final double height;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final devicePixelRatio = MediaQuery.devicePixelRatioOf(context);
    final branding = ref.watch(brandingProvider).valueOrNull;

    final customUrl = isDark
        ? (branding?.logoDarkUrl ?? branding?.logoUrl)
        : branding?.logoUrl;

    final fitforceLogo = Image.asset(
      isDark
          ? 'assets/images/logo_dark_theme.png'
          : 'assets/images/logo_light_theme.png',
      height: height,
      // Source is a fixed-aspect lockup (~3.7:1); let width follow height so it never
      // stretches, and decode at display resolution instead of the full source.
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      cacheHeight: (height * devicePixelRatio).round(),
    );

    final Widget logo = customUrl == null
        ? fitforceLogo
        : Image.network(
            customUrl,
            height: height,
            fit: BoxFit.contain,
            filterQuality: FilterQuality.high,
            cacheHeight: (height * devicePixelRatio).round(),
            // A broken/unreachable coach logo must never leave the header empty.
            errorBuilder: (_, __, ___) => fitforceLogo,
          );

    final hasName = branding != null && branding.name.isNotEmpty;
    final label = (customUrl != null && hasName) ? branding.name : 'FitForce';

    return Semantics(
      label: label,
      image: true,
      child: ExcludeSemantics(child: logo),
    );
  }
}
