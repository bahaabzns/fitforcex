/// The client's resolved subscription access, returned by
/// `GET /client-portal/access` and embedded in `GET /me`. The backend is the
/// single source of truth — this is a read-only mirror, never inferred locally.
///
/// Permission keys are the backend's snake_case flags (see server
/// `utils/subscriptionPolicy.ts` PERMISSION_KEYS). This class is the mobile
/// "permission layer": pages ask `access.canMessage` etc. rather than poking at
/// the raw map, so checks never get scattered or spelled inconsistently.
library;

enum SubscriptionStatus {
  active,
  preStart,
  expired,
  frozen,
  cancelled,
  noSubscriptions,
  unknown
}

SubscriptionStatus _parseStatus(String? raw) {
  switch ((raw ?? '').toLowerCase()) {
    case 'active':
      return SubscriptionStatus.active;
    case 'pre-start':
    case 'prestart':
      return SubscriptionStatus.preStart;
    case 'expired':
      return SubscriptionStatus.expired;
    case 'frozen':
      return SubscriptionStatus.frozen;
    case 'cancelled':
    case 'canceled':
      return SubscriptionStatus.cancelled;
    case 'no subscriptions':
    case 'no_subscriptions':
      return SubscriptionStatus.noSubscriptions;
    default:
      return SubscriptionStatus.unknown;
  }
}

class ClientAccess {
  const ClientAccess({
    required this.status,
    required this.statusRaw,
    required this.withinGrace,
    required this.permissions,
  });

  final SubscriptionStatus status;
  final String statusRaw;
  final bool withinGrace;
  final Map<String, bool> permissions;

  bool _flag(String key) => permissions[key] == true;

  // ── The permission layer (PermissionService) ──────────────────────────────
  bool get portalAccess => _flag('keep_portal_access');
  bool get canViewTraining => _flag('view_training_plans');
  bool get canViewNutrition => _flag('view_nutrition_plans');
  bool get canViewProgress => _flag('view_progress_history');
  bool get canViewAssessments => _flag('view_assessments');
  bool get canViewCheckins => _flag('view_checkins');
  bool get canMessage => _flag('allow_messaging');
  bool get canSubmitCheckins => _flag('allow_submit_checkins');
  bool get canBookAppointments => _flag('allow_booking_appointments');
  bool get canDownload => _flag('allow_download_files');

  // ── Status helpers ────────────────────────────────────────────────────────
  bool get isExpired => status == SubscriptionStatus.expired;
  bool get isFrozen => status == SubscriptionStatus.frozen;

  /// Whether to surface the persistent status card/banner: expired or frozen
  /// and not currently inside the expiry grace window.
  bool get isRestricted => !withinGrace && (isExpired || isFrozen);

  /// Forms tab covers both assessments and check-ins.
  bool get canViewForms => canViewAssessments || canViewCheckins;

  /// Permissive default used while access is still loading or unknown. The
  /// backend still enforces every gate (403), so an optimistic UI never leaks
  /// data — it just avoids briefly hiding things from an active client.
  factory ClientAccess.allAllowed() => const ClientAccess(
        status: SubscriptionStatus.unknown,
        statusRaw: '',
        withinGrace: false,
        permissions: {
          'keep_portal_access': true,
          'view_training_plans': true,
          'view_nutrition_plans': true,
          'view_progress_history': true,
          'view_assessments': true,
          'view_checkins': true,
          'allow_messaging': true,
          'allow_submit_checkins': true,
          'allow_booking_appointments': true,
          'allow_download_files': true,
        },
      );

  /// Parses `{ status, withinGrace, access: { ...flags } }` (the `/access`
  /// endpoint, also the shape embedded in `/me`). Tolerates a null `access`
  /// (treated as fully allowed) so a brand-new/unknown client is never locked out.
  factory ClientAccess.fromJson(Map<String, dynamic> json) {
    final rawAccess = json['access'];
    if (rawAccess is! Map) return ClientAccess.allAllowed();
    final flags = <String, bool>{
      for (final entry in rawAccess.entries)
        entry.key.toString(): entry.value == true,
    };
    return ClientAccess(
      status: _parseStatus(json['status'] as String?),
      statusRaw: (json['status'] as String?) ?? '',
      withinGrace: json['withinGrace'] == true,
      permissions: flags,
    );
  }

  Map<String, dynamic> toJson() => {
        'status': statusRaw,
        'withinGrace': withinGrace,
        'access': permissions,
      };
}
