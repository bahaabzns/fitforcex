/// The authenticated client's profile (`GET /client-portal/me`).
///
/// Hand-written for Phase 0; migrates to a freezed model in Phase 2 alongside
/// the rest of the API shapes.
class Client {
  const Client({
    required this.id,
    required this.fname,
    required this.lname,
    required this.email,
    required this.workspaceId,
    this.phone,
    this.clientCode,
  });

  final String id;
  final String fname;
  final String lname;
  final String email;
  final String workspaceId;
  final String? phone;
  final String? clientCode;

  String get fullName => '$fname $lname'.trim();

  String get initials {
    final f = fname.isNotEmpty ? fname[0] : '';
    final l = lname.isNotEmpty ? lname[0] : '';
    final result = '$f$l'.toUpperCase();
    return result.isEmpty ? '?' : result;
  }

  factory Client.fromJson(Map<String, dynamic> json) {
    return Client(
      id: json['id'] as String,
      fname: (json['fname'] as String?) ?? '',
      lname: (json['lname'] as String?) ?? '',
      email: (json['email'] as String?) ?? '',
      workspaceId: (json['workspace_id'] as String?) ?? '',
      phone: json['phone'] as String?,
      clientCode: json['client_code'] as String?,
    );
  }
}
