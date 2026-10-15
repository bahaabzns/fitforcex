/// A coach workspace's public branding identity, resolved either from a slug
/// before login (`GET /client-portal/workspace?slug=`) or from an email during
/// workspace discovery (`POST /client-portal/discover-workspace`).
///
/// `logoUrl` / `brandColor` carry the coach's custom branding. They are null
/// unless the coach's plan includes custom branding and the subscription is
/// active, so callers fall back to the FitForce defaults per field.
class Workspace {
  const Workspace({
    required this.slug,
    required this.name,
    this.logoUrl,
    this.brandColor,
    this.clientName,
  });

  final String slug;
  final String name;
  final String? logoUrl;
  final String? brandColor;

  /// The signed-in client's first name, only present on a discovery match —
  /// used to personalize the password step ("Welcome back, Sara").
  final String? clientName;

  factory Workspace.fromJson(Map<String, dynamic> json) {
    return Workspace(
      slug: (json['slug'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      logoUrl: json['logoUrl'] as String?,
      brandColor: json['brandColor'] as String?,
      clientName: json['clientName'] as String?,
    );
  }
}
