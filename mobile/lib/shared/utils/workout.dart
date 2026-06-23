import '../models/workout_session.dart';

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
