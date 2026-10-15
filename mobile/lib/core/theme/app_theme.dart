import 'package:flutter/material.dart';

import '../branding/brand_color.dart';
import 'app_colors.dart';

/// Light/dark Material 3 themes built from the ported design tokens.
class AppTheme {
  AppTheme._();

  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  /// Themes tinted with a coach's brand colors. A null [brand] is exactly the default
  /// FitForce theme; [accent] only feeds [AppSemanticColors.brandAccent].
  static ThemeData lightFor({Color? brand, Color? accent}) =>
      _build(Brightness.light, brand: brand, accent: accent);
  static ThemeData darkFor({Color? brand, Color? accent}) =>
      _build(Brightness.dark, brand: brand, accent: accent);

  static ThemeData _build(Brightness brightness, {Color? brand, Color? accent}) {
    final isDark = brightness == Brightness.dark;

    // Dark surfaces need a lighter tone of the brand hue to stay readable.
    final primary = brand == null
        ? AppColors.primary
        : (isDark ? BrandColor.liftForDark(brand) : brand);
    final onPrimary = brand == null
        ? AppColors.primaryForeground
        : BrandColor.foregroundFor(primary);
    final brandAccent = accent == null
        ? primary
        : (isDark ? BrandColor.liftForDark(accent) : accent);

    final background =
        isDark ? AppColors.darkBackground : AppColors.lightBackground;
    final foreground =
        isDark ? AppColors.darkForeground : AppColors.lightForeground;
    final secondary =
        isDark ? AppColors.darkSecondary : AppColors.lightSecondary;
    final border = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    final muted =
        isDark ? AppColors.darkMutedForeground : AppColors.lightMutedForeground;

    final scheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: brightness,
    ).copyWith(
      primary: primary,
      onPrimary: onPrimary,
      surface: background,
      onSurface: foreground,
      outline: border,
      error: AppColors.danger,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: background,
      dividerColor: border,
    );

    return base.copyWith(
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: foreground,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: true,
      ),
      cardTheme: CardThemeData(
        color: background,
        elevation: 0,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: border),
          borderRadius: BorderRadius.circular(AppRadii.xl),
        ),
        margin: EdgeInsets.zero,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: background,
        indicatorColor: primary.withValues(alpha: 0.12),
        elevation: 0,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: states.contains(WidgetState.selected)
                ? primary
                : muted,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? primary
                : muted,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: onPrimary,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: secondary,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: BorderSide(color: primary, width: 1.5),
        ),
      ),
      extensions: [
        AppSemanticColors(
          mutedForeground: muted,
          secondary: secondary,
          border: border,
          warning: AppColors.warning,
          success: AppColors.success,
          brandAccent: brandAccent,
        ),
      ],
    );
  }
}

/// Tokens Material's [ColorScheme] doesn't carry, exposed via theme extension
/// so widgets read them as `Theme.of(context).extension<AppSemanticColors>()`.
@immutable
class AppSemanticColors extends ThemeExtension<AppSemanticColors> {
  const AppSemanticColors({
    required this.mutedForeground,
    required this.secondary,
    required this.border,
    required this.warning,
    required this.success,
    required this.brandAccent,
  });

  final Color mutedForeground;
  final Color secondary;
  final Color border;
  final Color warning;
  final Color success;

  /// Coach's optional accent color (badges, banner dots); falls back to the primary.
  final Color brandAccent;

  @override
  AppSemanticColors copyWith({
    Color? mutedForeground,
    Color? secondary,
    Color? border,
    Color? warning,
    Color? success,
    Color? brandAccent,
  }) {
    return AppSemanticColors(
      mutedForeground: mutedForeground ?? this.mutedForeground,
      secondary: secondary ?? this.secondary,
      border: border ?? this.border,
      warning: warning ?? this.warning,
      success: success ?? this.success,
      brandAccent: brandAccent ?? this.brandAccent,
    );
  }

  @override
  AppSemanticColors lerp(ThemeExtension<AppSemanticColors>? other, double t) {
    if (other is! AppSemanticColors) return this;
    return AppSemanticColors(
      mutedForeground: Color.lerp(mutedForeground, other.mutedForeground, t)!,
      secondary: Color.lerp(secondary, other.secondary, t)!,
      border: Color.lerp(border, other.border, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      success: Color.lerp(success, other.success, t)!,
      brandAccent: Color.lerp(brandAccent, other.brandAccent, t)!,
    );
  }
}

extension AppThemeContextX on BuildContext {
  AppSemanticColors get appColors =>
      Theme.of(this).extension<AppSemanticColors>()!;
}
