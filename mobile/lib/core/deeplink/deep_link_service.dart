import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'workspace_link.dart';

/// The workspace slug delivered by the most recent deep link, consumed by the
/// login screen to pre-brand itself. `null` until a valid link arrives.
final pendingWorkspaceSlugProvider = StateProvider<String?>((ref) => null);

/// Listens for `fitforcex://w/<slug>` links (cold-start + while running) and
/// publishes the parsed slug to [pendingWorkspaceSlugProvider].
class DeepLinkService {
  DeepLinkService(this._ref, {AppLinks? appLinks})
      : _appLinks = appLinks ?? AppLinks();

  final Ref _ref;
  final AppLinks _appLinks;
  StreamSubscription<Uri>? _sub;

  Future<void> init() async {
    // Cold start: the link that launched the app, if any.
    final initial = await _appLinks.getInitialLink();
    if (initial != null) _handle(initial);

    // Warm: links received while the app is running.
    _sub = _appLinks.uriLinkStream.listen(_handle, onError: (_) {});
  }

  void _handle(Uri uri) {
    final slug = parseWorkspaceSlug(uri);
    if (slug != null) {
      _ref.read(pendingWorkspaceSlugProvider.notifier).state = slug;
    }
  }

  void dispose() => _sub?.cancel();
}

/// Keeps a single [DeepLinkService] alive for the app's lifetime. Watched once
/// at the root so the subscription stays active.
final deepLinkServiceProvider = Provider<DeepLinkService>((ref) {
  final service = DeepLinkService(ref);
  unawaited(service.init());
  ref.onDispose(service.dispose);
  return service;
});
