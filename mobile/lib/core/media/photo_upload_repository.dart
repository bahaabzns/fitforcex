import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../network/api_exception.dart';
import '../network/dio_client.dart';

/// Uploads a photo to `POST /client-portal/uploads/photo` (client-progress
/// photos: form check-in metric answers, the transformation timeline). Shared
/// by any feature that needs "pick or take a photo, get back a URL."
class PhotoUploadRepository {
  PhotoUploadRepository(this._dio);

  final Dio _dio;
  final ImagePicker _picker = ImagePicker();

  Future<XFile?> pick({required ImageSource source}) {
    return _picker.pickImage(source: source, imageQuality: 85);
  }

  Future<String> upload(XFile file) async {
    try {
      final form = FormData.fromMap({
        'photo': await MultipartFile.fromFile(file.path, filename: file.name),
      });
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/client-portal/uploads/photo',
        data: form,
      );
      return res.data!['url'] as String;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final photoUploadRepositoryProvider = Provider<PhotoUploadRepository>(
  (ref) => PhotoUploadRepository(ref.watch(dioProvider)),
);
