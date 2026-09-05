import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/access/access_controller.dart';
import '../../core/media/attachment_answer_field.dart';
import '../../core/media/photo_answer_field.dart';
import '../../core/network/api_exception.dart';
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

  // Per-question edit state — only one answer can be edited at a time, and
  // only after the form has already been submitted once (matches web).
  String? _editingQuestionId;
  String? _savingQuestionId;
  String? _editError;

  // Bumped on cancel to force the question fields to remount — a bare
  // TextFormField only reads `initialValue` on its first build, so
  // programmatically reverting `_answers` alone wouldn't update what's
  // actually displayed.
  int _fieldGeneration = 0;

  // 'sent' is the dispatcher cron's stamp on a due 'pending' request — still
  // awaiting the client's answer, not a submitted/locked state.
  bool get _isSubmitted =>
      widget.detail.status != formStatusPending &&
      widget.detail.status != formStatusSent;

  @override
  void initState() {
    super.initState();
    for (final r in widget.detail.responses) {
      if (r.answer != null) _answers[r.questionId] = r.answer!;
    }
  }

  FormResponse? _responseFor(String questionId) {
    for (final r in widget.detail.responses) {
      if (r.questionId == questionId) return r;
    }
    return null;
  }

  void _startEdit(String questionId) {
    setState(() {
      _editingQuestionId = questionId;
      _editError = null;
    });
  }

  void _cancelEdit(String questionId) {
    final response = _responseFor(questionId);
    setState(() {
      _answers[questionId] = response?.answer ?? '';
      _editingQuestionId = null;
      _editError = null;
      _fieldGeneration++;
    });
  }

  Future<void> _saveEdit(FormQuestion question) async {
    final l10n = AppLocalizations.of(context);
    if (question.required && (_answers[question.id] ?? '').trim().isEmpty) {
      setState(() => _editError = l10n.formsRequiredError(1));
      return;
    }

    setState(() {
      _savingQuestionId = question.id;
      _editError = null;
    });
    try {
      await ref.read(formsRepositoryProvider).editAnswer(
            widget.requestId,
            question.id,
            _answers[question.id] ?? '',
          );
      ref.invalidate(formRequestProvider(widget.requestId));
      if (mounted) {
        setState(() {
          _editingQuestionId = null;
          _savingQuestionId = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _savingQuestionId = null;
          _editError = e is ApiException ? e.message : l10n.formsEditFailed;
        });
      }
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
              key: ValueKey('${detail.questions[i].id}_g$_fieldGeneration'),
              index: i,
              question: detail.questions[i],
              locale: locale,
              value: _answers[detail.questions[i].id],
              enabled: !_isSubmitted ||
                  _editingQuestionId == detail.questions[i].id,
              onChanged: (v) =>
                  setState(() => _answers[detail.questions[i].id] = v),
              isSubmitted: _isSubmitted,
              canEdit: ref.watch(clientAccessProvider).canSubmitCheckins,
              response: _responseFor(detail.questions[i].id),
              isEditing: _editingQuestionId == detail.questions[i].id,
              isSaving: _savingQuestionId == detail.questions[i].id,
              editError: _editingQuestionId == detail.questions[i].id
                  ? _editError
                  : null,
              onStartEdit: () => _startEdit(detail.questions[i].id),
              onCancelEdit: () => _cancelEdit(detail.questions[i].id),
              onSaveEdit: () => _saveEdit(detail.questions[i]),
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
    super.key,
    required this.index,
    required this.question,
    required this.locale,
    required this.value,
    required this.enabled,
    required this.onChanged,
    required this.isSubmitted,
    required this.canEdit,
    required this.response,
    required this.isEditing,
    required this.isSaving,
    required this.editError,
    required this.onStartEdit,
    required this.onCancelEdit,
    required this.onSaveEdit,
  });

  final int index;
  final FormQuestion question;
  final String locale;
  final String? value;
  final bool enabled;
  final ValueChanged<String> onChanged;

  /// Whether the form as a whole has been submitted — edit controls only
  /// ever show once this is true.
  final bool isSubmitted;

  /// Whether the client's subscription plan allows editing (same access
  /// flag the submit button already gates on server-side).
  final bool canEdit;
  final FormResponse? response;
  final bool isEditing;
  final bool isSaving;
  final String? editError;
  final VoidCallback onStartEdit;
  final VoidCallback onCancelEdit;
  final VoidCallback onSaveEdit;

  List<String> get _options {
    if (locale == 'ar' && question.optionsAr.isNotEmpty) {
      return question.optionsAr;
    }
    return question.options;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
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
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      text: '${index + 1}. $label',
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600),
                      children: [
                        if (question.required)
                          TextSpan(
                            text: ' *',
                            style: TextStyle(
                                color: Theme.of(context).colorScheme.error),
                          ),
                      ],
                    ),
                  ),
                ),
                if (response?.edited ?? false) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: muted.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(l10n.formsAnswerEdited,
                        style: TextStyle(fontSize: 11, color: muted)),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            _input(context, l10n, hint),
            if (isSubmitted && canEdit) ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: isEditing
                    ? [
                        TextButton(
                          onPressed: isSaving ? null : onCancelEdit,
                          child: Text(l10n.commonCancel),
                        ),
                        const SizedBox(width: 4),
                        FilledButton(
                          // The theme's FilledButton default is full-width
                          // (Size.fromHeight), meant for standalone primary
                          // actions — override it here since this button
                          // shares a row with Cancel.
                          style: FilledButton.styleFrom(
                              minimumSize: const Size(64, 40)),
                          onPressed: isSaving ? null : onSaveEdit,
                          child: isSaving
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : Text(l10n.commonSave),
                        ),
                      ]
                    : [
                        OutlinedButton(
                          onPressed: onStartEdit,
                          child: Text(l10n.formsEditAnswer),
                        ),
                      ],
              ),
            ],
            if (editError != null) ...[
              const SizedBox(height: 4),
              Text(editError!,
                  style: TextStyle(
                      fontSize: 12, color: Theme.of(context).colorScheme.error)),
            ],
            if ((response?.edited ?? false) && !isEditing) ...[
              _AnswerEditHistory(history: response!.history, locale: locale),
            ],
          ],
        ),
      ),
    );
  }

  Widget _input(BuildContext context, AppLocalizations l10n, String hint) {
    switch (question.type) {
      case 'long_text':
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
      case 'date':
        return _DateInput(value: value, enabled: enabled, onChanged: onChanged);
      case 'metric':
        if (question.metricType == 'image') {
          return PhotoAnswerField(
            value: (value ?? '').isEmpty ? null : value,
            enabled: enabled,
            onChanged: onChanged,
          );
        }
        return TextFormField(
          initialValue: value,
          enabled: enabled,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            hintText: hint,
            suffixText: question.metricUnit,
          ),
          onChanged: onChanged,
        );
      case 'attachment':
        return AttachmentAnswerField(
          value: (value ?? '').isEmpty ? null : value,
          enabled: enabled,
          onChanged: onChanged,
          category: question.attachmentCategory ?? 'any',
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

class _DateInput extends StatelessWidget {
  const _DateInput({
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final String? value;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final parsed = DateTime.tryParse(value ?? '');
    final locale = Localizations.localeOf(context).toString();
    final label =
        parsed != null ? DateFormat.yMMMd(locale).format(parsed) : null;

    return InkWell(
      onTap: enabled
          ? () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: parsed ?? DateTime.now(),
                firstDate: DateTime(1900),
                lastDate: DateTime.now().add(const Duration(days: 365 * 5)),
              );
              if (picked != null) {
                onChanged(DateFormat('yyyy-MM-dd').format(picked));
              }
            }
          : null,
      borderRadius: BorderRadius.circular(8),
      child: InputDecorator(
        decoration: const InputDecoration(
          suffixIcon: Icon(Icons.calendar_today_outlined, size: 18),
        ),
        child: Text(
          label ?? l10n.formsSelectDate,
          style: label == null
              ? TextStyle(color: context.appColors.mutedForeground)
              : null,
        ),
      ),
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

/// Read-only trail of previous → new values for one answer, oldest first.
/// Web shows a relative "2h ago"-style timestamp per entry; this follows the
/// app's own established convention (locale-native absolute DateFormat, same
/// as notifications_page.dart) instead of building a parallel relative-time
/// string system just for this one feature.
class _AnswerEditHistory extends StatelessWidget {
  const _AnswerEditHistory({required this.history, required this.locale});

  final List<AnswerEditEntry> history;
  final String locale;

  @override
  Widget build(BuildContext context) {
    if (history.isEmpty) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: context.appColors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.formsEditHistory.toUpperCase(),
            style: TextStyle(
                fontSize: 10, fontWeight: FontWeight.w600, color: muted),
          ),
          const SizedBox(height: 4),
          for (final entry in history) _entryRow(context, entry, muted),
        ],
      ),
    );
  }

  Widget _entryRow(BuildContext context, AnswerEditEntry entry, Color muted) {
    final date = DateTime.tryParse(entry.editedAt);
    final dateLabel =
        date != null ? DateFormat.MMMd(locale).add_jm().format(date) : '';
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 6,
        children: [
          Text(
            (entry.previousAnswer ?? '').isEmpty ? '—' : entry.previousAnswer!,
            style: TextStyle(
                fontSize: 12,
                color: muted,
                decoration: TextDecoration.lineThrough),
          ),
          Text('→', style: TextStyle(fontSize: 12, color: muted)),
          Text(
            (entry.newAnswer ?? '').isEmpty ? '—' : entry.newAnswer!,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
          ),
          Text(dateLabel, style: TextStyle(fontSize: 11, color: muted)),
        ],
      ),
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
