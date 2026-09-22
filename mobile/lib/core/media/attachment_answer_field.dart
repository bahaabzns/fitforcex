import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../theme/app_theme.dart';
import 'attachment_upload_repository.dart';
import 'photo_answer_field.dart';

/// Pick-and-upload for the Forms `attachment` question type. For the
/// `images` category this delegates straight to [PhotoAnswerField] (same
/// camera/gallery picker, same inline preview) so the two question types
/// look and behave identically for photos. Every other category (documents/
/// videos/any) uses the native file picker and shows a file-chip instead of
/// an image thumbnail, since the file usually isn't an image.
class AttachmentAnswerField extends ConsumerStatefulWidget {
  const AttachmentAnswerField({
    super.key,
    required this.value,
    required this.enabled,
    required this.onChanged,
    required this.category,
  });

  /// Already-uploaded file URL, if any.
  final String? value;
  final bool enabled;
  final ValueChanged<String> onChanged;

  /// One of images/documents/videos/any — see
  /// server/src/lib/formAttachments.ts's ATTACHMENT_CATEGORIES.
  final String category;

  @override
  ConsumerState<AttachmentAnswerField> createState() =>
      _AttachmentAnswerFieldState();
}

class _AttachmentAnswerFieldState extends ConsumerState<AttachmentAnswerField> {
  bool _uploading = false;
  String? _error;

  Future<void> _pickAndUpload() async {
    final repo = ref.read(attachmentUploadRepositoryProvider);
    final file = await repo.pick(widget.category);
    if (file == null || !mounted) return;

    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final url = await repo.upload(file, widget.category);
      if (mounted) widget.onChanged(url);
    } catch (_) {
      if (mounted) {
        final l10n = AppLocalizations.of(context);
        setState(() => _error = l10n.formsAttachmentUploadFailed);
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  String _fileNameFromUrl(String url) {
    final path = Uri.tryParse(url)?.path ?? url;
    final segments = path.split('/');
    final segment = segments.isEmpty ? '' : segments.last;
    return segment.isEmpty ? 'file' : segment;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.category == 'images') {
      return PhotoAnswerField(
        value: widget.value,
        enabled: widget.enabled,
        onChanged: widget.onChanged,
      );
    }

    final l10n = AppLocalizations.of(context);
    final border = context.appColors.border;
    final hasFile = widget.value != null && widget.value!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (hasFile)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              border: Border.all(color: border),
              borderRadius: BorderRadius.circular(12),
              color: context.appColors.secondary,
            ),
            child: Row(
              children: [
                const Icon(Icons.attach_file, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _fileNameFromUrl(widget.value!),
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        if (widget.enabled) ...[
          const SizedBox(height: 8),
          InkWell(
            onTap: !_uploading ? _pickAndUpload : null,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              width: double.infinity,
              decoration: BoxDecoration(
                border: Border.all(color: border, style: BorderStyle.solid),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: _uploading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      hasFile
                          ? l10n.formsAttachmentTapToReplace
                          : l10n.formsAttachmentTapToUpload,
                      style: TextStyle(
                        fontSize: 13,
                        color: context.appColors.mutedForeground,
                      ),
                    ),
            ),
          ),
        ],
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(_error!,
                style: TextStyle(
                    fontSize: 12, color: Theme.of(context).colorScheme.error)),
          ),
      ],
    );
  }
}
