import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

import '../../../l10n/generated/app_localizations.dart';
import '../../../shared/utils/media_url.dart';

/// Inline exercise video. Uploaded mp4 plays inline via [VideoPlayer].
/// YouTube plays inline too, via [YoutubePlayerThumbnail] — the WebView-backed
/// iframe player only mounts after the client taps the thumbnail, so the
/// client never leaves the workout for the external YouTube app.
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
  YoutubePlayerController? _youtube;
  StreamSubscription<YoutubePlayerValue>? _youtubeSub;
  bool _youtubeError = false;

  @override
  void initState() {
    super.initState();
    final youtubeId = youtubeVideoId(widget.youtubeUrl);
    if (youtubeId != null) {
      _youtube = YoutubePlayerController.fromVideoId(videoId: youtubeId);
      // A plain iframe can't report YouTube's internal playback failures
      // (owner-restricted embedding, region locks) — this API-level
      // controller can, so a broken video shows a "Watch on YouTube"
      // fallback instead of getting stuck on a dead player.
      _youtubeSub = _youtube!.listen((value) {
        if (mounted && value.hasError && !_youtubeError) {
          setState(() => _youtubeError = true);
        }
      });
    } else if (widget.videoUrl != null) {
      _video = VideoPlayerController.networkUrl(Uri.parse(widget.videoUrl!))
        ..initialize().then((_) {
          if (mounted) setState(() => _videoReady = true);
        });
    }
  }

  @override
  void dispose() {
    _video?.dispose();
    unawaited(_youtubeSub?.cancel());
    unawaited(_youtube?.close());
    super.dispose();
  }

  Future<void> _openExternally() async {
    final url = widget.youtubeUrl;
    if (url == null) return;
    final uri = Uri.tryParse(url);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_youtube != null) {
      if (_youtubeError) {
        final l10n = AppLocalizations.of(context);
        return ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: InkWell(
              onTap: _openExternally,
              child: ColoredBox(
                color: Colors.black,
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.open_in_new,
                          size: 28, color: Colors.white70),
                      const SizedBox(height: 8),
                      Text(l10n.trainingWatchOnYoutube,
                          style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 13,
                              fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      }
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: YoutubePlayerThumbnail(controller: _youtube!),
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
          aspectRatio: _video!.value.aspectRatio == 0
              ? 16 / 9
              : _video!.value.aspectRatio,
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
