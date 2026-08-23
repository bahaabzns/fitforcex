import '../models/workout_log.dart';
import '../models/workout_session.dart';
import 'exercise_tracking_types.dart' as tracking;

/// Client-side workout math, mirroring the web `utils/workout.js` so the session
/// screen can show live totals while logging without a round-trip.

/// Parse a free-text field to a double, or null when blank/invalid.
double? toNumber(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;
  return double.tryParse(trimmed);
}

/// Epley estimated 1RM, rounded to one decimal. 0 when not computable.
double estimatedOneRepMax(double? weight, double? reps) {
  if (weight == null || reps == null || reps <= 0) return 0;
  return (weight * (1 + reps / 30) * 10).round() / 10;
}

/// Sum of weight × reps over completed sets of the session.
double totalVolume(List<SessionExercise> exercises) {
  var volume = 0.0;
  for (final exercise in exercises) {
    for (final set in exercise.sets) {
      final w = toNumber(set.weight);
      final r = toNumber(set.reps);
      if (set.completed && w != null && r != null) volume += w * r;
    }
  }
  return (volume * 10).round() / 10;
}

/// Count of completed sets across the session.
int completedSetCount(List<SessionExercise> exercises) {
  var count = 0;
  for (final exercise in exercises) {
    for (final set in exercise.sets) {
      if (set.completed) count++;
    }
  }
  return count;
}

/// Seconds → compact human string: "1h 05m", "45m 12s", "0:42". "—" for null.
String formatDuration(int? seconds) {
  if (seconds == null) return '—';
  final total = seconds < 0 ? 0 : seconds;
  final hours = total ~/ 3600;
  final mins = (total % 3600) ~/ 60;
  final secs = total % 60;
  if (hours > 0) return '${hours}h ${mins.toString().padLeft(2, '0')}m';
  if (mins > 0) return '${mins}m ${secs.toString().padLeft(2, '0')}s';
  return '${secs}s';
}

/// MM:SS countdown formatting for the rest timer.
String formatClock(int seconds) {
  final total = seconds < 0 ? 0 : seconds;
  final mins = total ~/ 60;
  final secs = total % 60;
  return '$mins:${secs.toString().padLeft(2, '0')}';
}

/// The training builder seeds a new set's tempo with "-" as a placeholder —
/// it reads as "not filled in" the same as null/empty, so treat all three as
/// blank when deciding whether a coach actually entered a tempo.
bool hasTempoValue(String? tempo) {
  final trimmed = tempo?.trim() ?? '';
  return trimmed.isNotEmpty && trimmed != '-';
}

/// RIR has no placeholder sentinel like tempo — null is the only "not set" state.
bool hasRirValue(int? rir) => rir != null;

String _formatCompact(double v) =>
    v == v.roundToDouble() ? v.toInt().toString() : v.toString();

/// "80kg × 8" (sets_reps) or "45s · 2km" (time_based) for a previous logged
/// set, or null when there's nothing to show. Shared by the live session card
/// and the day-preview grid so both read the same "Previous" column the same way.
String? previousSetLabel(PreviousSet? previous, String category) {
  if (previous == null) return null;
  if (category == tracking.setsReps) {
    if (previous.weight == null || previous.reps == null) return null;
    return '${_formatCompact(previous.weight!)}kg × ${_formatCompact(previous.reps!)}';
  }
  final parts = <String>[];
  if (previous.durationSeconds != null) {
    parts.add(formatClock(previous.durationSeconds!));
  }
  if (previous.distanceKm != null) {
    parts.add('${_formatCompact(previous.distanceKm!)}km');
  }
  return parts.isEmpty ? null : parts.join(' · ');
}
