/// Pure parsing of workspace onboarding deep links — no plugin access, so it's
/// unit-testable. Supported shapes:
///
///   `fitforcex://w/<slug>`
///   `fitforcex://workspace?slug=<slug>`
///
/// Returns a validated slug (`[a-z0-9-]`, lower-cased) or `null` when the URI is
/// not a recognisable workspace link.
String? parseWorkspaceSlug(Uri uri) {
  if (uri.scheme != 'fitforcex') return null;

  // fitforcex://w/<slug>
  if (uri.host == 'w' && uri.pathSegments.isNotEmpty) {
    return _sanitize(uri.pathSegments.first);
  }
  // fitforcex://workspace?slug=<slug>
  if (uri.host == 'workspace') {
    return _sanitize(uri.queryParameters['slug']);
  }
  return null;
}

String? _sanitize(String? raw) {
  if (raw == null) return null;
  final slug = raw.trim().toLowerCase();
  if (slug.isEmpty) return null;
  // Slugs are lowercase alphanumerics and hyphens (mirrors the web slug rules).
  return RegExp(r'^[a-z0-9-]+$').hasMatch(slug) ? slug : null;
}
