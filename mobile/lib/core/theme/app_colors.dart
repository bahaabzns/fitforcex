import 'package:flutter/material.dart';

/// Design tokens ported from `client/app/globals.css`.
///
/// Brand/primary is the logo blue `#159BFF` (oklch(0.675 0.18 249)).
class AppColors {
  AppColors._();

  // Brand
  static const Color primary = Color(0xFF159BFF);
  static const Color primaryForeground = Color(0xFFFDFDFD);

  // Light
  static const Color lightBackground = Color(0xFFFFFFFF);
  static const Color lightForeground = Color(0xFF0A0A0A);
  static const Color lightSecondary = Color(0xFFF1F3F5);
  static const Color lightMutedForeground =
      Color(0xFF6B7280); // hsl(220 9% 46%)
  static const Color lightBorder = Color(0xFFE5E7EB); // hsl(220 13% 91%)

  // Dark
  static const Color darkBackground = Color(0xFF0B0D0F);
  static const Color darkForeground = Color(0xFFF5F5F5);
  static const Color darkSecondary = Color(0xFF1A1D21);
  static const Color darkMutedForeground =
      Color(0xFF9AA4B2); // hsl(215 20% 65%)
  static const Color darkBorder = Color(0xFF3E4046); // hsl(240 5% 26%)

  // Shared semantic accents (used across the portal)
  static const Color warning = Color(0xFFEAB308); // yellow-500 notes
  static const Color success = Color(0xFF22C55E);
  static const Color danger = Color(0xFFEF4444);
}

/// Card-radius scale ported from `--radius` (default 0.625rem ≈ 10px) family.
class AppRadii {
  AppRadii._();
  static const double sm = 6;
  static const double md = 8;
  static const double lg = 10;
  static const double xl = 16;
  static const double xxl = 24;
  static const double pill = 999;
}
