import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/insight_prompt.dart';

/// Talks to `/client-portal/prompts/*` (Founder Prompt micro-surveys) and
/// `/client-portal/insights*` (the feedback entry point: bug/feature/rating
/// reports, with an optional screenshot). Mirrors the coach dashboard's
/// `/api/insights/*` shape one-to-one; the client portal's is just flatter.
class InsightsRepository {
  InsightsRepository(this._dio);

  final Dio _dio;
  final ImagePicker _picker = ImagePicker();

  Future<InsightPrompt?> fetchActivePrompt() =>
      _fetchPrompt('/api/client-portal/prompts/active');

  Future<InsightPrompt?> fetchPostSessionPrompt() =>
      _fetchPrompt('/api/client-portal/prompts/post-session');

  Future<InsightPrompt?> fetchPromptForTrigger(String event) =>
      _fetchPrompt('/api/client-portal/prompts/for-trigger/$event');

  Future<InsightPrompt?> _fetchPrompt(String path) async {
    try {
      final res = await _dio.get<Map<String, dynamic>?>(path);
      final data = res.data;
      return data == null ? null : InsightPrompt.fromJson(data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> respondToPrompt(
    String promptId, {
    int? ratingValue,
    String? selectedOption,
    String? textValue,
  }) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '/api/client-portal/prompts/$promptId/respond',
        data: {
          if (ratingValue != null) 'ratingValue': ratingValue,
          if (selectedOption != null) 'selectedOption': selectedOption,
          if (textValue != null) 'textValue': textValue,
        },
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Best-effort, matching web: a failed dismiss/started ping never blocks
  /// the UI, so these swallow their own errors rather than throwing.
  Future<void> dismissPrompt(String promptId) async {
    try {
      await _dio.post<void>('/api/client-portal/prompts/$promptId/dismiss');
    } catch (_) {
      // Best-effort.
    }
  }

  Future<void> markPromptStarted(String promptId) async {
    try {
      await _dio.post<void>('/api/client-portal/prompts/$promptId/started');
    } catch (_) {
      // Best-effort.
    }
  }

  Future<void> submitInsight({
    required String sourceType,
    String? textValue,
    int? ratingValue,
    String? module,
    String? screenshotUrl,
  }) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '/api/client-portal/insights',
        data: {
          'sourceType': sourceType,
          if (textValue != null) 'textValue': textValue,
          if (ratingValue != null) 'ratingValue': ratingValue,
          if (module != null) 'module': module,
          if (screenshotUrl != null) 'screenshotUrl': screenshotUrl,
        },
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<XFile?> pickScreenshot() {
    return _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
  }

  Future<String> uploadScreenshot(XFile file) async {
    try {
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(file.path, filename: file.name),
      });
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/client-portal/insights/screenshot',
        data: form,
      );
      return res.data!['url'] as String;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final insightsRepositoryProvider = Provider<InsightsRepository>(
  (ref) => InsightsRepository(ref.watch(dioProvider)),
);
