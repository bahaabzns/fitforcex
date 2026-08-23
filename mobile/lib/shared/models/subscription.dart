import 'package:freezed_annotation/freezed_annotation.dart';

import 'json_converters.dart';

part 'subscription.freezed.dart';
part 'subscription.g.dart';

/// `GET /client-portal/subscription` — plan, current period, and payment
/// history. Unlike most client-portal endpoints this one is already
/// camelCase on the wire (mirrors `mapRow` in
/// server/src/modules/transactions/transactions.controller.ts), so field
/// names match directly with no `@JsonKey` renaming needed.
@freezed
abstract class SubscriptionSummary with _$SubscriptionSummary {
  const factory SubscriptionSummary({
    /// 'Active' | 'Expired' | 'Frozen' | 'Pre-start' | 'Refunded', or null.
    String? status,
    @Default(false) bool withinGrace,
    SubscriptionPlan? plan,
    String? currentPeriodStart,
    String? currentPeriodEnd,
    /// Extends past currentPeriodEnd by any already-paid-ahead renewal on
    /// file — falls back to currentPeriodEnd when there's none.
    String? totalCoverageEnd,
    String? frozenUntil,
    String? renewalLink,
    @Default(<SubscriptionTransaction>[]) List<SubscriptionTransaction> transactions,
  }) = _SubscriptionSummary;

  factory SubscriptionSummary.fromJson(Map<String, dynamic> json) =>
      _$SubscriptionSummaryFromJson(json);
}

@freezed
abstract class SubscriptionPlan with _$SubscriptionPlan {
  const factory SubscriptionPlan({
    @Default('') String name,
    @NumToDoubleOrNull() double? price,
    String? currency,
    int? durationDays,
  }) = _SubscriptionPlan;

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) =>
      _$SubscriptionPlanFromJson(json);
}

@freezed
abstract class SubscriptionTransaction with _$SubscriptionTransaction {
  const factory SubscriptionTransaction({
    required String id,
    String? packageVariation,
    @NumToDouble() @Default(0) double amount,
    String? currency,
    required String date,
    /// The transaction's own point-in-time status, distinct from the
    /// summary's current `status` — e.g. a past transaction can read
    /// 'Refunded' while the client's subscription is currently 'Active'.
    String? subscriptionStatus,
  }) = _SubscriptionTransaction;

  factory SubscriptionTransaction.fromJson(Map<String, dynamic> json) =>
      _$SubscriptionTransactionFromJson(json);
}
