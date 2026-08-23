import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_controller.dart';
import '../../core/access/client_access.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/auth/auth_state.dart';
import '../../core/router/app_routes.dart';
import '../../core/unread/unread_indicators.dart';
import '../../core/widgets/brand_logo.dart';
import '../../l10n/generated/app_localizations.dart';
import '../access/subscription_status_banner.dart';
import '../access/subscription_status_card.dart';
import '../insights/widgets/insight_banner.dart';
import '../notifications/notifications_repository.dart';

/// Bottom-nav unread dot color — deliberately a fixed red (not the theme's
/// `error` color, which may be tuned for form-validation contexts) so it
/// reads as "new" consistently in both light and dark mode.
const _unreadDotColor = Color(0xFFEF4444);

/// App shell: top bar (avatar · logo · notifications) + bottom tab bar.
/// The parallel of `ClientPortalNav`. Hides tabs the subscription no longer
/// grants, shows a status banner when restricted, and replaces the whole shell
/// with a status card when the portal is closed entirely.
class ShellPage extends ConsumerStatefulWidget {
  const ShellPage({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<ShellPage> createState() => _ShellPageState();
}

class _ShellPageState extends ConsumerState<ShellPage>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Re-read access when the app returns to the foreground (status may have
    // changed while it was backgrounded — e.g. a renewal or coach policy edit).
    if (state == AppLifecycleState.resumed) {
      ref.read(accessControllerProvider.notifier).refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authControllerProvider);
    final access = ref.watch(clientAccessProvider);
    final unreadCount = ref.watch(unreadNotificationsCountProvider);
    final initials = switch (auth) {
      Authenticated(:final client) => client.initials,
      _ => '?',
    };

    final appBar = AppBar(
      leading: Center(
        child: GestureDetector(
          onTap: () => context.push(AppRoutes.profile),
          child: CircleAvatar(
            radius: 16,
            backgroundColor: Theme.of(context).colorScheme.primary,
            child: Text(
              initials,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Theme.of(context).colorScheme.onPrimary,
              ),
            ),
          ),
        ),
      ),
      centerTitle: true,
      title: const BrandLogo(),
      actions: [
        IconButton(
          icon: Badge(
            isLabelVisible: unreadCount > 0,
            label: Text(unreadCount > 99 ? '99+' : '$unreadCount'),
            child: const Icon(Icons.notifications_outlined),
          ),
          onPressed: () => context.push(AppRoutes.notifications),
        ),
      ],
    );

    // Portal closed entirely → only the status card (no tabs, no module content).
    if (!access.portalAccess) {
      return Scaffold(
        appBar: appBar,
        body: SubscriptionStatusCard(access: access),
      );
    }

    final unread = _UnreadFlags(
      nutrition: ref.watch(nutritionUnreadProvider),
      training: ref.watch(trainingUnreadProvider),
      forms: ref.watch(formsUnreadProvider),
      messages: ref.watch(messagesUnreadProvider),
    );
    final tabs = _visibleTabs(l10n, access, unread);
    final currentBranch = widget.navigationShell.currentIndex;
    final selected = tabs.indexWhere((t) => t.branchIndex == currentBranch);

    return Scaffold(
      appBar: appBar,
      body: Stack(
        children: [
          Column(
            children: [
              SubscriptionStatusBanner(access: access),
              Expanded(child: widget.navigationShell),
            ],
          ),
          const Positioned(
            left: 0,
            right: 0,
            bottom: 12,
            child: SafeArea(top: false, child: InsightBanner()),
          ),
        ],
      ),
      // NavigationBar requires ≥2 destinations; if a workspace restricts the app
      // down to only Home, drop the bar (the module pages still guard themselves).
      bottomNavigationBar: tabs.length < 2
          ? null
          : NavigationBar(
              selectedIndex: selected < 0 ? 0 : selected,
              onDestinationSelected: (i) => _goBranch(tabs[i].branchIndex),
              // Material 3 modern pattern: only the selected tab shows its
              // label (icon-only otherwise); NavigationBar animates the
              // label's appearance/disappearance itself.
              labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
              destinations: [
                for (final t in tabs)
                  NavigationDestination(
                    icon: _BadgedIcon(icon: t.icon, showDot: t.hasUnread),
                    selectedIcon:
                        _BadgedIcon(icon: t.selectedIcon, showDot: t.hasUnread),
                    label: t.label,
                    tooltip: t.hasUnread
                        ? l10n.navUnreadTooltip(t.label)
                        : t.label,
                  ),
              ],
            ),
    );
  }

  List<_Tab> _visibleTabs(
      AppLocalizations l10n, ClientAccess access, _UnreadFlags unread) {
    return [
      _Tab(0, Icons.home_outlined, Icons.home, l10n.navHome, true, false),
      _Tab(1, Icons.restaurant_outlined, Icons.restaurant, l10n.navNutrition,
          access.canViewNutrition, unread.nutrition),
      _Tab(2, Icons.fitness_center_outlined, Icons.fitness_center,
          l10n.navTraining, access.canViewTraining || access.canViewProgress,
          unread.training),
      _Tab(3, Icons.assignment_outlined, Icons.assignment, l10n.navForms,
          access.canViewForms, unread.forms),
      _Tab(4, Icons.chat_bubble_outline, Icons.chat_bubble, l10n.navMessages,
          access.canMessage, unread.messages),
    ].where((t) => t.visible).toList();
  }

  void _goBranch(int branchIndex) {
    widget.navigationShell.goBranch(
      branchIndex,
      initialLocation: branchIndex == widget.navigationShell.currentIndex,
    );
  }
}

class _Tab {
  const _Tab(this.branchIndex, this.icon, this.selectedIcon, this.label,
      this.visible, this.hasUnread);
  final int branchIndex;
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final bool visible;
  final bool hasUnread;
}

/// Snapshot of which tabs currently have unseen content, computed once per
/// build so `_visibleTabs` stays a pure mapping function.
class _UnreadFlags {
  const _UnreadFlags({
    required this.nutrition,
    required this.training,
    required this.forms,
    required this.messages,
  });
  final bool nutrition;
  final bool training;
  final bool forms;
  final bool messages;
}

/// A tab icon with a small red "unseen content" dot — deliberately a plain
/// dot (no count) per the product spec. Doesn't affect the icon's layout box.
class _BadgedIcon extends StatelessWidget {
  const _BadgedIcon({required this.icon, required this.showDot});

  final IconData icon;
  final bool showDot;

  @override
  Widget build(BuildContext context) {
    return Badge(
      isLabelVisible: showDot,
      backgroundColor: _unreadDotColor,
      offset: const Offset(4, -4),
      child: Icon(icon),
    );
  }
}
