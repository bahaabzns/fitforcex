import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_exception.dart';
import '../network/dio_client.dart';

/// Uploads a file to `POST /client-portal/uploads/attachment/:category` for
/// the Forms `attachment` question type. The category comes from the
/// question's configuration (forms.controller.ts) and both selects the
/// native file-picker's allowed types AND is sent as part of the URL, where
/// the server independently re-validates against its own allowlist for that
/// category (see server/src/lib/formAttachments.ts) — never trusted from the
/// client alone.
class AttachmentUploadRepository {
  AttachmentUploadRepository(this._dio);

  final Dio _dio;

  static const Map<String, List<String>> _extensionsByCategory = {
    'images': ['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif'],
    'documents': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
    'videos': ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm'],
  };

  Future<PlatformFile?> pick(String category) async {
    final extensions = _extensionsByCategory[category];
    final result = await FilePicker.pickFiles(
      type: extensions != null ? FileType.custom : FileType.any,
      allowedExtensions: extensions,
      withData: false,
    );
    if (result == null || result.files.isEmpty) return null;
    return result.files.first;
  }

  Future<String> upload(PlatformFile file, String category) async {
    if (file.path == null) {
      throw const ApiException(message: 'Could not read the selected file');
    }
    try {
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(file.path!, filename: file.name),
      });
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/client-portal/uploads/attachment/$category',
        data: form,
      );
      return res.data!['url'] as String;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final attachmentUploadRepositoryProvider =
    Provider<AttachmentUploadRepository>(
  (ref) => AttachmentUploadRepository(ref.watch(dioProvider)),
);
