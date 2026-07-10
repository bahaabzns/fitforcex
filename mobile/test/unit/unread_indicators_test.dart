import 'package:fitforce_x/core/unread/unread_indicators.dart';
import 'package:fitforce_x/features/forms/forms_repository.dart';
import 'package:fitforce_x/features/notifications/notifications_repository.dart';
import 'package:fitforce_x/features/nutrition/nutrition_repository.dart';
import 'package:fitforce_x/features/training/training_repository.dart';
import 'package:fitforce_x/shared/models/form.dart';
import 'package:fitforce_x/shared/models/notification.dart';
import 'package:fitforce_x/shared/models/nutrition_plan.dart';
import 'package:fitforce_x/shared/models/training_plan.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('nutritionUnreadProvider', () {
    test('true for a plan never marked seen, false after markSeen', () async {
      const plan = NutritionPlan(id: 'p1', activatedAt: '2026-01-01T00:00:00Z');
      final container = ProviderContainer(overrides: [
        activeNutritionPlanProvider.overrideWith((ref) async => plan),
      ]);
      addTearDown(container.dispose);

      await container.read(activeNutritionPlanProvider.future);
      expect(container.read(nutritionUnreadProvider), isTrue);

      await container
          .read(nutritionPlanSeenProvider.notifier)
          .markSeen('${plan.id}|${plan.activatedAt}');
      expect(container.read(nutritionUnreadProvider), isFalse);
    });

    test('a restart (new activated_at, same id) reopens the dot', () async {
      final container = ProviderContainer(overrides: [
        activeNutritionPlanProvider.overrideWith(
            (ref) async => const NutritionPlan(id: 'p1', activatedAt: 'v2')),
      ]);
      addTearDown(container.dispose);

      await container.read(activeNutritionPlanProvider.future);
      await container.read(nutritionPlanSeenProvider.notifier).markSeen('p1|v1');
      expect(container.read(nutritionUnreadProvider), isTrue);
    });

    test('no active plan is never unread', () async {
      final container = ProviderContainer(overrides: [
        activeNutritionPlanProvider.overrideWith((ref) async => null),
      ]);
      addTearDown(container.dispose);

      await container.read(activeNutritionPlanProvider.future);
      expect(container.read(nutritionUnreadProvider), isFalse);
    });
  });

  group('trainingUnreadProvider', () {
    test('mirrors the nutrition behavior for training plans', () async {
      const plan = TrainingPlan(id: 't1', activatedAt: '2026-01-01T00:00:00Z');
      final container = ProviderContainer(overrides: [
        activeTrainingPlanProvider.overrideWith((ref) async => plan),
      ]);
      addTearDown(container.dispose);

      await container.read(activeTrainingPlanProvider.future);
      expect(container.read(trainingUnreadProvider), isTrue);

      await container
          .read(trainingPlanSeenProvider.notifier)
          .markSeen('${plan.id}|${plan.activatedAt}');
      expect(container.read(trainingUnreadProvider), isFalse);
    });
  });

  group('formsUnreadProvider', () {
    test('a pending request not yet seen shows unread', () async {
      final requests = [
        const FormRequestSummary(id: 'r1', status: formStatusPending),
      ];
      final container = ProviderContainer(overrides: [
        formRequestsProvider.overrideWith((ref) async => requests),
      ]);
      addTearDown(container.dispose);

      await container.read(formRequestsProvider.future);
      expect(container.read(formsUnreadProvider), isTrue);
    });

    test('marking seen clears the dot even though the request is still pending',
        () async {
      final requests = [
        const FormRequestSummary(id: 'r1', status: formStatusPending),
      ];
      final container = ProviderContainer(overrides: [
        formRequestsProvider.overrideWith((ref) async => requests),
      ]);
      addTearDown(container.dispose);

      await container.read(formRequestsProvider.future);
      await container.read(formsSeenProvider.notifier).markSeen({'r1'});
      expect(container.read(formsUnreadProvider), isFalse,
          reason: 'seen but unfilled — dot means "new," not "incomplete"');
    });

    test('a brand new request id reopens the dot', () async {
      final requests = [
        const FormRequestSummary(id: 'r1', status: formStatusPending),
        const FormRequestSummary(id: 'r2', status: formStatusScheduled),
      ];
      final container = ProviderContainer(overrides: [
        formRequestsProvider.overrideWith((ref) async => requests),
      ]);
      addTearDown(container.dispose);

      await container.read(formRequestsProvider.future);
      await container.read(formsSeenProvider.notifier).markSeen({'r1'});
      expect(container.read(formsUnreadProvider), isTrue,
          reason: 'r2 (scheduled) is a new, unseen request');
    });

    test('submitted/reviewed requests never trigger the dot', () async {
      final requests = [
        const FormRequestSummary(id: 'r1', status: formStatusSubmitted),
        const FormRequestSummary(id: 'r2', status: formStatusReviewed),
      ];
      final container = ProviderContainer(overrides: [
        formRequestsProvider.overrideWith((ref) async => requests),
      ]);
      addTearDown(container.dispose);

      await container.read(formRequestsProvider.future);
      expect(container.read(formsUnreadProvider), isFalse);
    });
  });

  group('messagesUnreadProvider', () {
    test('true when there is an unread message.received notification',
        () async {
      final container = ProviderContainer(overrides: [
        unreadNotificationsProvider.overrideWith((ref) => Stream.value([
              AppNotification.fromJson(const {
                'id': 'n1',
                'type': 'message.received',
                'title': 'New message from your coach',
              }),
            ])),
      ]);
      addTearDown(container.dispose);

      await container.read(unreadNotificationsProvider.future);
      expect(container.read(messagesUnreadProvider), isTrue);
    });

    test('false when unread notifications are of other types', () async {
      final container = ProviderContainer(overrides: [
        unreadNotificationsProvider.overrideWith((ref) => Stream.value([
              AppNotification.fromJson(const {
                'id': 'n1',
                'type': 'plan.assigned',
                'title': 'A new plan was assigned to you',
              }),
            ])),
      ]);
      addTearDown(container.dispose);

      await container.read(unreadNotificationsProvider.future);
      expect(container.read(messagesUnreadProvider), isFalse);
    });
  });
}
