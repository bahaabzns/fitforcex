import 'package:flutter/material.dart';

import 'brand_color.dart';

/// One coach banner shown on Home.
class PortalBanner {
  const PortalBanner({
    required this.id,
    required this.imageUrl,
    this.title,
    this.linkUrl,
  });

  final String id;
  final String imageUrl;
  final String? title;
  final String? linkUrl;

  factory PortalBanner.fromJson(Map<String, dynamic> json) {
    return PortalBanner(
      id: (json['id'] as String?) ?? '',
      imageUrl: (json['imageUrl'] as String?) ?? '',
      title: json['title'] as String?,
      linkUrl: json['linkUrl'] as String?,
    );
  }
}

/// The signed-in client's coach branding (`GET /client-portal/branding`). The server has
/// already applied plan + subscription gating, so null fields always mean "use the
/// FitForce default".
class PortalBranding {
  const PortalBranding({
    this.name = '',
    this.logoUrl,
    this.logoDarkUrl,
    this.primaryColor,
    this.accentColor,
    this.welcomeMessage,
    this.banners = const [],
  });

  static const PortalBranding none = PortalBranding();

  final String name;
  final String? logoUrl;
  final String? logoDarkUrl;
  final Color? primaryColor;
  final Color? accentColor;
  final String? welcomeMessage;
  final List<PortalBanner> banners;

  factory PortalBranding.fromJson(Map<String, dynamic> json) {
    final rawBanners = json['banners'];
    return PortalBranding(
      name: (json['name'] as String?) ?? '',
      logoUrl: _nonEmpty(json['logoUrl'] as String?),
      logoDarkUrl: _nonEmpty(json['logoDarkUrl'] as String?),
      primaryColor: BrandColor.tryParse(json['brandColor'] as String?),
      accentColor: BrandColor.tryParse(json['accentColor'] as String?),
      welcomeMessage: _nonEmpty(json['welcomeMessage'] as String?),
      banners: rawBanners is List
          ? rawBanners
              .whereType<Map<String, dynamic>>()
              .map(PortalBanner.fromJson)
              .where((b) => b.imageUrl.isNotEmpty)
              .toList()
          : const [],
    );
  }

  static String? _nonEmpty(String? value) =>
      (value == null || value.isEmpty) ? null : value;
}
