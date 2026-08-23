import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/subscription.dart';
import 'subscription_repository.dart';
import 'widgets/subscription_status_chip.dart';

/// Plan, current period, and payment history. Port of the web
/// `portal/subscription` page.
class SubscriptionPage extends ConsumerWidget {
  const SubscriptionPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final subscription = ref.watch(subscriptionProvider);

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.pop()),
        title: Text(l10n.subscriptionTitle),
      ),
      body: AsyncValueWidget<SubscriptionSummary>(
        value: subscription,
        onRetry: () => ref.invalidate(subscriptionProvider),
        data: (data) => ListView(
          padding: const EdgeInsets.all(24),
          children: [
            if (data.plan == null)
              _NoSubscriptionCard(text: l10n.subscriptionNoSubscription)
            else
              _PlanCard(data: data),
            const SizedBox(height: 20),
            _PaymentHistory(transactions: data.transactions),
          ],
        ),
      ),
    );
  }
}

class _NoSubscriptionCard extends StatelessWidget {
  const _NoSubscriptionCard({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: context.appColors.secondary,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(color: context.appColors.mutedForeground),
      ),
    );
  }
}

/// The active-period row's label + value, and whether a renew progress bar
/// applies — the exact same status-driven branching as web's `periodRow`/
/// `showProgress`.
class _PeriodInfo {
  const _PeriodInfo({this.label, this.value, required this.showProgress});
  final String? label;
  final String? value;
  final bool showProgress;
}

_PeriodInfo _periodInfo(AppLocalizations l10n, SubscriptionSummary data,
    String Function(String iso) dateLabel) {
  String? label;
  String? value;
  if (data.status == 'Frozen' && data.frozenUntil != null) {
    label = l10n.subscriptionFrozenUntil;
    value = dateLabel(data.frozenUntil!);
  } else if (data.status == 'Pre-start' && data.currentPeriodStart != null) {
    label = l10n.subscriptionStartsOn;
    value = dateLabel(data.currentPeriodStart!);
  } else if (data.status == 'Expired' && data.currentPeriodEnd != null) {
    label = l10n.subscriptionExpiredOn;
    value = dateLabel(data.currentPeriodEnd!);
  } else if (data.currentPeriodEnd != null) {
    label = l10n.subscriptionRenewsOn;
    value = dateLabel(data.currentPeriodEnd!);
  }

  final showProgress = (data.status == 'Active' || data.status == 'Frozen') &&
      data.currentPeriodStart != null &&
      data.currentPeriodEnd != null;

  return _PeriodInfo(label: label, value: value, showProgress: showProgress);
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.data});
  final SubscriptionSummary data;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    final muted = context.appColors.mutedForeground;
    final plan = data.plan!;

    String dateLabel(String iso) {
      final d = DateTime.tryParse(iso);
      return d != null ? DateFormat.yMMMd(locale).format(d) : iso;
    }

    final period = _periodInfo(l10n, data, dateLabel);

    int totalDays = 0, daysRemaining = 0;
    double percentElapsed = 0;
    if (period.showProgress) {
      final start = DateTime.parse(data.currentPeriodStart!);
      final endIso = data.totalCoverageEnd ?? data.currentPeriodEnd!;
      final end = DateTime.parse(endIso);
      final today = DateTime.now();
      final startDay = DateTime(start.year, start.month, start.day);
      final endDay = DateTime(end.year, end.month, end.day);
      final todayDay = DateTime(today.year, today.month, today.day);
      totalDays = endDay.difference(startDay).inDays;
      if (totalDays < 0) totalDays = 0;
      daysRemaining = endDay.difference(todayDay).inDays;
      if (daysRemaining < 0) daysRemaining = 0;
      if (daysRemaining > totalDays) daysRemaining = totalDays;
      percentElapsed =
          totalDays > 0 ? ((totalDays - daysRemaining) / totalDays) * 100 : 0;
    }

    final showRenewCta = data.status == 'Expired' || data.status == 'Frozen';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: context.appColors.secondary,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(plan.name,
                        style: const TextStyle(
                            fontSize: 17, fontWeight: FontWeight.bold)),
                    if (plan.price != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          '${NumberFormat.decimalPattern(locale).format(plan.price)} ${plan.currency ?? ''}'
                          '${plan.durationDays != null ? ' / ${l10n.subscriptionDurationDays(plan.durationDays!)}' : ''}',
                          style: TextStyle(fontSize: 13, color: muted),
                        ),
                      ),
                  ],
                ),
              ),
              if (data.status != null) SubscriptionStatusChip(status: data.status),
            ],
          ),
          if (period.label != null) ...[
            const SizedBox(height: 12),
            Container(height: 1, color: context.appColors.border),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(period.label!, style: TextStyle(fontSize: 13, color: muted)),
                Text(period.value!,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ),
          ],
          if (period.showProgress) ...[
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  l10n.subscriptionDaysRemainingLabel(daysRemaining, totalDays),
                  style: TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w600, color: muted),
                ),
                Text('${percentElapsed.round()}%',
                    style: TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w600, color: muted)),
              ],
            ),
            const SizedBox(height: 4),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: (percentElapsed / 100).clamp(0, 1),
                minHeight: 6,
                backgroundColor: context.appColors.border,
              ),
            ),
          ],
          if (showRenewCta) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: data.renewalLink == null
                    ? null
                    : () => launchUrl(Uri.parse(data.renewalLink!),
                        mode: LaunchMode.externalApplication),
                child: Text(l10n.subscriptionRenewCta),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PaymentHistory extends StatelessWidget {
  const _PaymentHistory({required this.transactions});
  final List<SubscriptionTransaction> transactions;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    final muted = context.appColors.mutedForeground;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Text(
            l10n.subscriptionPaymentHistory.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
              color: muted,
            ),
          ),
        ),
        const SizedBox(height: 6),
        if (transactions.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Text(l10n.subscriptionNoPaymentHistory,
                style: TextStyle(fontSize: 13, color: muted)),
          )
        else
          for (final tx in transactions) ...[
            _TransactionTile(tx: tx, locale: locale),
            const SizedBox(height: 8),
          ],
      ],
    );
  }
}

class _TransactionTile extends StatelessWidget {
  const _TransactionTile({required this.tx, required this.locale});
  final SubscriptionTransaction tx;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final muted = context.appColors.mutedForeground;
    final date = DateTime.tryParse(tx.date);
    final dateLabel =
        date != null ? DateFormat.yMMMd(locale).format(date) : tx.date;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: context.appColors.secondary,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (tx.packageVariation ?? '').isEmpty ? '—' : tx.packageVariation!,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(dateLabel, style: TextStyle(fontSize: 11, color: muted)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${NumberFormat.decimalPattern(locale).format(tx.amount)} ${tx.currency ?? ''}',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
              ),
              if (tx.subscriptionStatus != null) ...[
                const SizedBox(height: 3),
                SubscriptionStatusChip(status: tx.subscriptionStatus),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
