/// A coach workspace's public branding identity, resolved from a slug before
/// login (`GET /client-portal/workspace?slug=`).
///
/// `logoUrl` / `brandColor` aren't modelled server-side yet (the endpoint
/// returns null); the fields exist so the UI can adopt them without a contract
/// change when they land.
class Workspace {
  const Workspace({
    required this.slug,
    required this.name,
    this.logoUrl,
    this.brandColor,
  });

  final String slug;
  final String name;
  final String? logoUrl;
  final String? brandColor;

  factory Workspace.fromJson(Map<String, dynamic> json) {
    return Workspace(
      slug: (json['slug'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      logoUrl: json['logoUrl'] as String?,
      brandColor: json['brandColor'] as String?,
    );
  }
}
