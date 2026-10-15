import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fitforce_x/core/branding/brand_color.dart';
import 'package:fitforce_x/core/branding/portal_branding.dart';
import 'package:fitforce_x/core/theme/app_colors.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';

void main() {
  group('BrandColor.tryParse', () {
    test('parses #RRGGBB', () {
      expect(BrandColor.tryParse('#ff5500'), const Color(0xFFFF5500));
    });

    test('rejects null, short hex and junk', () {
      expect(BrandColor.tryParse(null), isNull);
      expect(BrandColor.tryParse('#fff'), isNull);
      expect(BrandColor.tryParse('red'), isNull);
      expect(BrandColor.tryParse('#ff5500; x'), isNull);
    });
  });

  group('BrandColor tones', () {
    test('picks white text on dark colors and black on light colors', () {
      expect(BrandColor.foregroundFor(const Color(0xFF0B1F3A)), Colors.white);
      expect(BrandColor.foregroundFor(const Color(0xFFFFE600)), Colors.black);
    });

    test('leaves a readable color unchanged for dark mode', () {
      const blue = Color(0xFF3B82F6);
      expect(BrandColor.liftForDark(blue), blue);
    });

    test('lightens a dark color until it reads on the dark background', () {
      const navy = Color(0xFF1D3A8A);
      final lifted = BrandColor.liftForDark(navy);
      expect(lifted, isNot(navy));
      expect(BrandColor.contrast(lifted, const Color(0xFF1C1C1F)),
          greaterThanOrEqualTo(4.5));
    });
  });

  group('PortalBranding.fromJson', () {
    test('maps the server payload and drops invalid colors and banners', () {
      final branding = PortalBranding.fromJson({
        'name': 'Coach Co',
        'logoUrl': 'https://cdn.example.com/logo.webp',
        'logoDarkUrl': '',
        'brandColor': '#ff5500',
        'accentColor': 'not-a-color',
        'welcomeMessage': 'Welcome aboard',
        'banners': [
          {'id': 'a', 'imageUrl': 'https://cdn.example.com/a.webp', 'title': 'Hi'},
          {'id': 'b', 'imageUrl': ''},
        ],
      });

      expect(branding.name, 'Coach Co');
      expect(branding.logoUrl, 'https://cdn.example.com/logo.webp');
      expect(branding.logoDarkUrl, isNull);
      expect(branding.primaryColor, const Color(0xFFFF5500));
      expect(branding.accentColor, isNull);
      expect(branding.welcomeMessage, 'Welcome aboard');
      expect(branding.banners.map((b) => b.id), ['a']);
    });

    test('an all-null payload is the default branding', () {
      final branding = PortalBranding.fromJson({'name': 'X'});
      expect(branding.primaryColor, isNull);
      expect(branding.banners, isEmpty);
    });
  });

  group('AppTheme.lightFor', () {
    test('without a brand color is the default FitForce primary', () {
      expect(AppTheme.lightFor().colorScheme.primary, AppColors.primary);
    });

    test('applies the brand color and a readable foreground', () {
      final theme = AppTheme.lightFor(brand: const Color(0xFFFFE600));
      expect(theme.colorScheme.primary, const Color(0xFFFFE600));
      expect(theme.colorScheme.onPrimary, Colors.black);
    });

    test('lightens a dark brand color in the dark theme', () {
      const navy = Color(0xFF1D3A8A);
      final theme = AppTheme.darkFor(brand: navy);
      expect(theme.colorScheme.primary, isNot(navy));
    });
  });
}
