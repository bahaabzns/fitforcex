import 'package:flutter/material.dart';

/// Brand-color helpers. Mirrors `client/lib/brandTheme.js` so web and mobile derive the
/// same readable foreground and the same dark-mode tone from a coach's primary color.
class BrandColor {
  BrandColor._();

  static final RegExp _hex = RegExp(r'^#[0-9a-fA-F]{6}$');

  // Approximates the dark page background (AppColors.darkBackground / web `.dark` surface).
  static const Color _darkSurface = Color(0xFF1C1C1F);
  static const double _minTextContrast = 4.5;
  static const double _liftStep = 0.1;
  static const double _maxLift = 0.6;

  /// Parses `#RRGGBB`; anything else (null, short hex, junk) yields null → default theme.
  static Color? tryParse(String? value) {
    if (value == null || !_hex.hasMatch(value)) return null;
    return Color(0xFF000000 | int.parse(value.substring(1), radix: 16));
  }

  static double _luminance(Color c) => c.computeLuminance();

  static double contrast(Color a, Color b) {
    final la = _luminance(a);
    final lb = _luminance(b);
    final hi = la > lb ? la : lb;
    final lo = la > lb ? lb : la;
    return (hi + 0.05) / (lo + 0.05);
  }

  /// White or black text — whichever reads better on [color].
  static Color foregroundFor(Color color) {
    const white = Color(0xFFFFFFFF);
    const black = Color(0xFF000000);
    return contrast(color, white) >= contrast(color, black) ? white : black;
  }

  static Color _mixWithWhite(Color color, double amount) {
    int channel(double c) => (c * 255 + (255 - c * 255) * amount).round();
    return Color.fromARGB(0xFF, channel(color.r), channel(color.g), channel(color.b));
  }

  /// A lighter tone of the same hue that reads (≥4.5:1) on dark surfaces; unchanged when
  /// the color already does.
  static Color liftForDark(Color color) {
    for (var amount = 0.0; amount <= _maxLift + 1e-9; amount += _liftStep) {
      final candidate = amount == 0 ? color : _mixWithWhite(color, amount);
      if (contrast(candidate, _darkSurface) >= _minTextContrast) return candidate;
    }
    return _mixWithWhite(color, _maxLift);
  }
}
