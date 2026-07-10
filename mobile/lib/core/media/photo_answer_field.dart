import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../l10n/generated/app_localizations.dart';
import '../theme/app_theme.dart';
import 'photo_upload_repository.dart';

/// Pick-or-take-a-photo, upload it, and report back the resulting URL. Shared
/// by the Forms `metric`(image) question renderer and the Progress
/// transformation timeline's photo-metric answers.
class PhotoAnswerField extends ConsumerStatefulWidget {
  const PhotoAnswerField({
    super.key,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  /// Already-uploaded photo URL, if any.
  final String? value;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  ConsumerState<PhotoAnswerField> createState() => _PhotoAnswerFieldState();
}

class _PhotoAnswerFieldState extends ConsumerState<PhotoAnswerField> {
  bool _uploading = false;
  String? _error;

  Future<void> _pick(ImageSource source) async {
    final repo = ref.read(photoUploadRepositoryProvider);
    final file = await repo.pick(source: source);
    if (file == null || !mounted) return;

    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final url = await repo.upload(file);
      if (mounted) widget.onChanged(url);
    } catch (_) {
      if (mounted) {
        final l10n = AppLocalizations.of(context);
        setState(() => _error = l10n.formsPhotoUploadFailed);
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _showSourceSheet() {
    final l10n = AppLocalizations.of(context);
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: Text(l10n.formsPhotoTakePhoto),
              onTap: () {
                Navigator.pop(ctx);
                _pick(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text(l10n.formsPhotoChooseFromGallery),
              onTap: () {
                Navigator.pop(ctx);
                _pick(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final border = context.appColors.border;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.value != null)
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  widget.value!,
                  height: 160,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    height: 160,
                    alignment: Alignment.center,
                    color: context.appColors.secondary,
                    child: const Icon(Icons.broken_image_outlined),
                  ),
                ),
              ),
              if (widget.enabled)
                Positioned(
                  top: 6,
                  right: 6,
                  child: IconButton.filled(
                    onPressed: () => widget.onChanged(''),
                    icon: const Icon(Icons.close, size: 16),
                    tooltip: l10n.formsPhotoRemove,
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.black54,
                      minimumSize: const Size(28, 28),
                    ),
                  ),
                ),
            ],
          )
        else
          InkWell(
            onTap: widget.enabled && !_uploading ? _showSourceSheet : null,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              height: 120,
              width: double.infinity,
              decoration: BoxDecoration(
                border: Border.all(color: border),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: _uploading
                  ? const CircularProgressIndicator()
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add_a_photo_outlined,
                            color: context.appColors.mutedForeground),
                        const SizedBox(height: 6),
                        Text(l10n.formsPhotoAdd,
                            style: TextStyle(
                                fontSize: 12,
                                color: context.appColors.mutedForeground)),
                      ],
                    ),
            ),
          ),
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
