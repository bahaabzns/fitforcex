import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/branding/branding_provider.dart';
import '../../core/branding/portal_branding.dart';
import '../../core/router/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Coach banners at the top of Home. Renders nothing when there are none — no plan, no banners,
/// or branding hidden by plan/expiry — so Home is unchanged for non-branded workspaces.
class PortalBannerCarousel extends ConsumerStatefulWidget {
  const PortalBannerCarousel({super.key});

  @override
  ConsumerState<PortalBannerCarousel> createState() =>
      _PortalBannerCarouselState();
}

class _PortalBannerCarouselState extends ConsumerState<PortalBannerCarousel> {
  static const double _aspectRatio = 3 / 1;
  final PageController _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _open(BuildContext context, PortalBanner banner) async {
    final link = banner.linkUrl;
    if (link == null || link.isEmpty) return;

    // The server only stores https:// URLs and /portal/... paths; re-check before acting.
    if (link.startsWith('https://')) {
      final uri = Uri.tryParse(link);
      if (uri != null) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      return;
    }
    if (!context.mounted) return;
    switch (link) {
      case '/portal/nutrition':
        context.go(AppRoutes.nutrition);
      case '/portal/training':
        context.go(AppRoutes.training);
      case '/portal/forms':
        context.go(AppRoutes.forms);
      case '/portal/messages':
        context.go(AppRoutes.messages);
      case '/portal/home':
        context.go(AppRoutes.home);
      case '/portal/profile':
        context.go(AppRoutes.profile);
      case '/portal/notifications':
        unawaited(context.push(AppRoutes.notifications));
      case '/portal/subscription':
        unawaited(context.push(AppRoutes.subscription));
    }
  }

  @override
  Widget build(BuildContext context) {
    final branding = ref.watch(brandingProvider).valueOrNull;
    final banners = branding?.banners ?? const <PortalBanner>[];
    final welcome = branding?.welcomeMessage;
    if (banners.isEmpty && welcome == null) return const SizedBox.shrink();

    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (welcome != null)
            Padding(
              padding: EdgeInsets.only(bottom: banners.isEmpty ? 0 : 12),
              child: Text(
                welcome,
                style: TextStyle(fontSize: 13.5, color: colors.mutedForeground),
              ),
            ),
          if (banners.isNotEmpty) AspectRatio(
            aspectRatio: _aspectRatio,
            child: PageView.builder(
              controller: _controller,
              itemCount: banners.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (context, i) {
                final banner = banners[i];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: GestureDetector(
                    onTap: () => _open(context, banner),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(AppRadii.xl),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.network(
                            banner.imageUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) =>
                                ColoredBox(color: colors.secondary),
                          ),
                          if (banner.title != null && banner.title!.isNotEmpty)
                            Align(
                              alignment: Alignment.bottomCenter,
                              child: Container(
                                width: double.infinity,
                                padding:
                                    const EdgeInsets.fromLTRB(14, 24, 14, 10),
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.bottomCenter,
                                    end: Alignment.topCenter,
                                    colors: [
                                      Color(0xB3000000),
                                      Color(0x00000000),
                                    ],
                                  ),
                                ),
                                child: Text(
                                  banner.title!,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          if (banners.length > 1) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < banners.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    height: 6,
                    width: i == _index ? 20 : 6,
                    decoration: BoxDecoration(
                      color: i == _index ? colors.brandAccent : colors.border,
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
