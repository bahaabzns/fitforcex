import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import '../../../shared/utils/media_url.dart';

/// Inline exercise video. Uploaded mp4 plays inline via [VideoPlayer]; YouTube
/// shows a tappable thumbnail that opens the YouTube app/browser (we avoid an
/// in-app webview — see the dependency note in pubspec).
class ExerciseVideo extends StatefulWidget {
  const ExerciseVideo({super.key, this.youtubeUrl, this.videoUrl});

  final String? youtubeUrl;

  /// Already resolved to an absolute URL by the caller.
  final String? videoUrl;

  @override
  State<ExerciseVideo> createState() => _ExerciseVideoState();
}

class _ExerciseVideoState extends State<ExerciseVideo> {
  VideoPlayerController? _video;
  bool _videoReady = false;

  bool get _isYoutube => youtubeVideoId(widget.youtubeUrl) != null;

  @override
  void initState() {
    super.initState();
    if (!_isYoutube && widget.videoUrl != null) {
      _video = VideoPlayerController.networkUrl(Uri.parse(widget.videoUrl!))
        ..initialize().then((_) {
          if (mounted) setState(() => _videoReady = true);
        });
    }
  }

  @override
  void dispose() {
    _video?.dispose();
    super.dispose();
  }

  Future<void> _openYoutube() async {
    final uri = Uri.tryParse(widget.youtubeUrl ?? '');
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isYoutube) {
      final id = youtubeVideoId(widget.youtubeUrl)!;
      final thumb = 'https://img.youtube.com/vi/$id/hqdefault.jpg';
      return GestureDetector(
        onTap: _openYoutube,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.network(
                  thumb,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) =>
                      const ColoredBox(color: Colors.black),
                ),
                const ColoredBox(color: Color(0x33000000)),
                const Center(
                  child: Icon(Icons.play_circle_fill,
                      size: 56, color: Colors.white),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_video != null) {
      if (!_videoReady) {
        return const AspectRatio(
          aspectRatio: 16 / 9,
          child: ColoredBox(
            color: Colors.black,
            child: Center(child: CircularProgressIndicator()),
          ),
        );
      }
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: AspectRatio(
          aspectRatio:
              _video!.value.aspectRatio == 0 ? 16 / 9 : _video!.value.aspectRatio,
          child: GestureDetector(
            onTap: () => setState(
              () => _video!.value.isPlaying ? _video!.pause() : _video!.play(),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                VideoPlayer(_video!),
                if (!_video!.value.isPlaying)
                  const ColoredBox(
                    color: Color(0x33000000),
                    child: Center(
                      child: Icon(Icons.play_circle_fill,
                          size: 56, color: Colors.white),
                    ),
                  ),
              ],
            ),
          ),
        ),
      );
    }

    return const SizedBox.shrink();
  }
}
