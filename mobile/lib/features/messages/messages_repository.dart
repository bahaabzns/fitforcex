import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/message.dart';

/// The thread payload: messages plus the coach/workspace display name.
typedef MessagesThread = ({List<Message> messages, String? coachName});

/// Talks to `/client-portal/messages` — fetch the thread and send a message.
class MessagesRepository {
  MessagesRepository(this._dio);

  final Dio _dio;

  Future<MessagesThread> fetchThread() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/client-portal/messages',
      );
      final data = res.data ?? {};
      final messages = (data['messages'] as List<dynamic>? ?? [])
          .map((e) => Message.fromJson(e as Map<String, dynamic>))
          .toList();
      return (messages: messages, coachName: data['coachName'] as String?);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Message> send(String body) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/client-portal/messages',
        data: {'body': body},
      );
      return Message.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final messagesRepositoryProvider = Provider<MessagesRepository>(
  (ref) => MessagesRepository(ref.watch(dioProvider)),
);
