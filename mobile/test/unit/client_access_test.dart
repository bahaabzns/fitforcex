import 'package:fitforce_x/core/access/client_access.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ClientAccess.fromJson', () {
    test('parses status + withinGrace + snake_case flags', () {
      final access = ClientAccess.fromJson(const {
        'status': 'Expired',
        'withinGrace': false,
        'access': {
          'keep_portal_access': true,
          'view_training_plans': true,
          'view_nutrition_plans': true,
          'view_progress_history': true,
          'view_assessments': true,
          'view_checkins': true,
          'allow_messaging': false,
          'allow_submit_checkins': false,
          'allow_booking_appointments': false,
          'allow_download_files': false,
        },
      });

      expect(access.status, SubscriptionStatus.expired);
      expect(access.isExpired, isTrue);
      expect(access.portalAccess, isTrue);
      expect(access.canViewTraining, isTrue);
      expect(access.canViewForms, isTrue);
      expect(access.canMessage, isFalse);
      expect(access.canSubmitCheckins, isFalse);
      expect(access.isRestricted, isTrue);
    });

    test('maps each backend status string to the enum', () {
      ClientAccess withStatus(String s) =>
          ClientAccess.fromJson({'status': s, 'access': const {}});
      expect(withStatus('Active').status, SubscriptionStatus.active);
      expect(withStatus('Pre-start').status, SubscriptionStatus.preStart);
      expect(withStatus('Frozen').status, SubscriptionStatus.frozen);
      expect(withStatus('Cancelled').status, SubscriptionStatus.cancelled);
      expect(withStatus('No Subscriptions').status,
          SubscriptionStatus.noSubscriptions);
    });

    test('null access is treated as fully allowed (never locks out)', () {
      final access = ClientAccess.fromJson(const {'status': 'Active'});
      expect(access.portalAccess, isTrue);
      expect(access.canMessage, isTrue);
    });

    test('missing flags default to false', () {
      final access = ClientAccess.fromJson(const {
        'status': 'Frozen',
        'access': {'keep_portal_access': true},
      });
      expect(access.portalAccess, isTrue);
      expect(access.canViewNutrition, isFalse);
    });
  });

  group('grace window', () {
    test('expired-but-within-grace is not restricted', () {
      final access = ClientAccess.fromJson(const {
        'status': 'Expired',
        'withinGrace': true,
        'access': {'keep_portal_access': true},
      });
      expect(access.isExpired, isTrue);
      expect(access.isRestricted, isFalse);
    });
  });

  group('round-trip', () {
    test('toJson → fromJson preserves flags and status', () {
      final original = ClientAccess.fromJson(const {
        'status': 'Frozen',
        'withinGrace': false,
        'access': {
          'keep_portal_access': true,
          'allow_messaging': true,
        },
      });
      final restored = ClientAccess.fromJson(original.toJson());
      expect(restored.status, SubscriptionStatus.frozen);
      expect(restored.canMessage, isTrue);
      expect(restored.portalAccess, isTrue);
    });
  });

  group('allAllowed', () {
    test('grants everything', () {
      final access = ClientAccess.allAllowed();
      expect(access.portalAccess, isTrue);
      expect(access.canDownload, isTrue);
      expect(access.isRestricted, isFalse);
    });
  });
}
