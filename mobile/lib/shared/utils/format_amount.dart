/// Formats a nutrition amount (grams, eaten quantity, etc.) for display:
/// drops the decimal for whole numbers, otherwise shows full precision.
/// Single source of truth — this was previously copy-pasted per screen with
/// drifting behavior (one copy rounded to 1 decimal instead).
String prettyAmount(double v) =>
    v == v.roundToDouble() ? v.toInt().toString() : v.toString();
