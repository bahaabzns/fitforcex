import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/form.dart';
import '../../shared/utils/localization.dart';
import '../access/restricted_view.dart';
import 'forms_repository.dart';

/// Renders a form request's questions and submits answers. Read-only once
/// submitted (answers prefilled). Port of the web forms/[requestId] page.
class FormFillPage extends ConsumerWidget {
  const FormFillPage({super.key, required this.requestId});

  final String requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final canView = ref.watch(clientAccessProvider).canViewForms;

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.pop()),
        title: Text(l10n.formsTitle),
      ),
      body: !canView
          ? RestrictedView(message: l10n.restrictedForms)
          : _buildBody(ref),
    );
  }

  Widget _buildBody(WidgetRef ref) {
    final detail = ref.watch(formRequestProvider(requestId));
    return AsyncValueWidget<FormRequestDetail>(
      value: detail,
      onRetry: () => ref.invalidate(formRequestProvider(requestId)),
      data: (detail) => _FormBody(requestId: requestId, detail: detail),
    );
  }
}

class _FormBody extends ConsumerStatefulWidget {
  const _FormBody({required this.requestId, required this.detail});

  final String requestId;
  final FormRequestDetail detail;

  @override
  ConsumerState<_FormBody> createState() => _FormBodyState();
}

class _FormBodyState extends ConsumerState<_FormBody> {
  final Map<String, String> _answers = {};
  bool _submitting = false;
  String? _error;

  bool get _isSubmitted => widget.detail.status != formStatusPending;

  @override
  void initState() {
    super.initState();
    for (final r in widget.detail.responses) {
      if (r.answer != null) _answers[r.questionId] = r.answer!;
    }
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final missing = widget.detail.questions
        .where((q) => q.required && (_answers[q.id] ?? '').trim().isEmpty)
        .length;
    if (missing > 0) {
      setState(() => _error = l10n.formsRequiredError(missing));
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final payload = {
        for (final q in widget.detail.questions) q.id: _answers[q.id] ?? '',
      };
      await ref.read(formsRepositoryProvider).submit(widget.requestId, payload);
      ref.invalidate(formRequestsProvider);
      if (mounted) context.pop();
    } catch (_) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = l10n.formsSubmitFailed;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final detail = widget.detail;
    final title = localizedField(
      base: detail.formTitleEn ?? '',
      arabic: detail.formTitleAr,
      localeCode: locale,
    );
    final desc = localizedField(
      base: detail.formDescriptionEn ?? '',
      arabic: detail.formDescriptionAr,
      localeCode: locale,
    );

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(title,
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.bold)),
        if (desc.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(desc,
                style: TextStyle(color: context.appColors.mutedForeground)),
          ),
        if (_isSubmitted) ...[
          const SizedBox(height: 12),
          _Banner(message: l10n.formsAlreadySubmitted),
        ],
        const SizedBox(height: 16),
        for (var i = 0; i < detail.questions.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: _QuestionField(
              index: i,
              question: detail.questions[i],
              locale: locale,
              value: _answers[detail.questions[i].id],
              enabled: !_isSubmitted,
              onChanged: (v) =>
                  setState(() => _answers[detail.questions[i].id] = v),
            ),
          ),
        if (_error != null) ...[
          _Banner(message: _error!, error: true),
          const SizedBox(height: 12),
        ],
        if (!_isSubmitted) ...[
          if (ref.watch(clientAccessProvider).canSubmitCheckins)
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child:
                  Text(_submitting ? l10n.formsSubmitting : l10n.formsSubmit),
            )
          else ...[
            _Banner(message: l10n.restrictedCheckinSubmit),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: null,
              child: Text(l10n.formsSubmit),
            ),
          ],
        ],
      ],
    );
  }
}

class _QuestionField extends StatelessWidget {
  const _QuestionField({
    required this.index,
    required this.question,
    required this.locale,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final int index;
  final FormQuestion question;
  final String locale;
  final String? value;
  final bool enabled;
  final ValueChanged<String> onChanged;

  List<String> get _options {
    if (locale == 'ar' && question.optionsAr.isNotEmpty) {
      return question.optionsAr;
    }
    return question.options;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final label = localizedField(
      base: question.labelEn,
      arabic: question.labelAr,
      localeCode: locale,
    );
    final hint = localizedField(
      base: question.placeholderEn ?? '',
      arabic: question.placeholderAr,
      localeCode: locale,
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text.rich(
              TextSpan(
                text: '${index + 1}. $label',
                style:
                    const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                children: [
                  if (question.required)
                    TextSpan(
                      text: ' *',
                      style:
                          TextStyle(color: Theme.of(context).colorScheme.error),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            _input(context, l10n, hint),
          ],
        ),
      ),
    );
  }

  Widget _input(BuildContext context, AppLocalizations l10n, String hint) {
    switch (question.type) {
      case 'textarea':
        return TextFormField(
          initialValue: value,
          enabled: enabled,
          maxLines: 4,
          decoration: InputDecoration(hintText: hint),
          onChanged: onChanged,
        );
      case 'number':
        return TextFormField(
          initialValue: value,
          enabled: enabled,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(hintText: hint),
          onChanged: onChanged,
        );
      case 'scale':
        return _ScaleInput(
          min: question.minValue ?? 1,
          max: question.maxValue ?? 10,
          value: value,
          enabled: enabled,
          onChanged: onChanged,
        );
      case 'select':
        return DropdownButtonFormField<String>(
          initialValue:
              (value != null && _options.contains(value)) ? value : null,
          decoration: const InputDecoration(),
          hint: Text(l10n.formsSelectOption),
          items: [
            for (final opt in _options)
              DropdownMenuItem(value: opt, child: Text(opt)),
          ],
          onChanged: enabled ? (v) => onChanged(v ?? '') : null,
        );
      case 'multiselect':
        return _MultiSelectInput(
          options: _options,
          value: value ?? '',
          enabled: enabled,
          onChanged: onChanged,
        );
      default: // text
        return TextFormField(
          initialValue: value,
          enabled: enabled,
          decoration: InputDecoration(hintText: hint),
          onChanged: onChanged,
        );
    }
  }
}

class _ScaleInput extends StatelessWidget {
  const _ScaleInput({
    required this.min,
    required this.max,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final int min;
  final int max;
  final String? value;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final current = double.tryParse(value ?? '') ?? min.toDouble();
    final clamped = current.clamp(min.toDouble(), max.toDouble());
    return Column(
      children: [
        Row(
          children: [
            Text('$min',
                style: TextStyle(color: context.appColors.mutedForeground)),
            Expanded(
              child: Slider(
                min: min.toDouble(),
                max: max.toDouble(),
                divisions: (max - min) > 0 ? max - min : 1,
                value: clamped,
                label: clamped.round().toString(),
                onChanged:
                    enabled ? (v) => onChanged(v.round().toString()) : null,
              ),
            ),
            Text('$max',
                style: TextStyle(color: context.appColors.mutedForeground)),
          ],
        ),
        Text(
          clamped.round().toString(),
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
      ],
    );
  }
}

class _MultiSelectInput extends StatelessWidget {
  const _MultiSelectInput({
    required this.options,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final List<String> options;
  final String value; // comma-separated
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final selected = value.split(',').where((s) => s.isNotEmpty).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final opt in options)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            dense: true,
            title: Text(opt, style: const TextStyle(fontSize: 14)),
            value: selected.contains(opt),
            onChanged: enabled
                ? (checked) {
                    final next = [...selected];
                    if (checked == true) {
                      next.add(opt);
                    } else {
                      next.remove(opt);
                    }
                    onChanged(next.join(','));
                  }
                : null,
          ),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.message, this.error = false});

  final String message;
  final bool error;

  @override
  Widget build(BuildContext context) {
    final color =
        error ? Theme.of(context).colorScheme.error : context.appColors.success;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Icon(error ? Icons.error_outline : Icons.check_circle,
              size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(message, style: TextStyle(color: color))),
        ],
      ),
    );
  }
}
