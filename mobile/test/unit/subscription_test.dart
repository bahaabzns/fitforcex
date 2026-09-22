import 'package:fitforce_x/shared/models/subscription.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('SubscriptionSummary.fromJson', () {
    test('parses camelCase fields directly (no snake_case on this endpoint)',
        () {
      final summary = SubscriptionSummary.fromJson({
        'status': 'Active',
        'withinGrace': false,
        'plan': {
          'name': 'Premium — Monthly',
          'price': 49.99,
          'currency': 'USD',
          'durationDays': 30,
        },
        'currentPeriodStart': '2026-08-01T00:00:00Z',
        'currentPeriodEnd': '2026-08-31T00:00:00Z',
        'totalCoverageEnd': null,
        'frozenUntil': null,
        'renewalLink': 'https://pay.example.com/renew',
        'transactions': [
          {
            'id': 'tx-1',
            'packageVariation': 'Premium — Monthly',
            'amount': 49.99,
            'currency': 'USD',
            'date': '2026-08-01T00:00:00Z',
            'subscriptionStatus': 'Active',
          },
        ],
      });

      expect(summary.status, 'Active');
      expect(summary.plan!.name, 'Premium — Monthly');
      expect(summary.plan!.price, 49.99);
      expect(summary.plan!.durationDays, 30);
      expect(summary.currentPeriodEnd, '2026-08-31T00:00:00Z');
      expect(summary.renewalLink, 'https://pay.example.com/renew');
      expect(summary.transactions, hasLength(1));
      expect(summary.transactions.single.packageVariation, 'Premium — Monthly');
      expect(summary.transactions.single.amount, 49.99);
    });

    test('defaults to null plan and empty transactions when absent', () {
      final summary = SubscriptionSummary.fromJson({});

      expect(summary.status, isNull);
      expect(summary.plan, isNull);
      expect(summary.transactions, isEmpty);
      expect(summary.withinGrace, isFalse);
    });
  });
}
