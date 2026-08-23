/// Single source of truth for how an exercise is tracked, mirroring
/// server/src/config/exerciseTrackingTypes.ts / client/utils/exerciseTrackingTypes.js
/// (no shared package across web/server/mobile exists in this repo). Keep
/// all three in sync.
///
/// Every exercise belongs to one of two categories, set once on the catalog
/// exercise and inherited by every plan/log use. Each category has a few
/// "base" fields always tracked, plus a checklist of optional metrics the
/// coach turns on per exercise (trackedMetrics) — e.g. one Sets & Reps
/// exercise might track tempo + rir, another just rir, another neither.
library;

const setsReps = 'sets_reps';
const timeBased = 'time_based';
const exerciseCategories = [setsReps, timeBased];
const defaultCategory = setsReps;

class CategoryConfig {
  const CategoryConfig({
    required this.fieldOrder,
    required this.prescribedBaseFields,
    required this.loggedBaseFields,
    required this.selectableMetrics,
    required this.selectableIsLoggable,
  });

  final List<String> fieldOrder;
  final List<String> prescribedBaseFields;
  final List<String> loggedBaseFields;
  final List<String> selectableMetrics;
  final bool selectableIsLoggable;
}

const categoryConfig = <String, CategoryConfig>{
  setsReps: CategoryConfig(
    fieldOrder: ['reps', 'rest_seconds', 'tempo', 'rir', 'rpe'],
    prescribedBaseFields: ['reps', 'rest_seconds'],
    loggedBaseFields: ['weight', 'reps'],
    selectableMetrics: ['tempo', 'rir', 'rpe'],
    selectableIsLoggable: false,
  ),
  timeBased: CategoryConfig(
    fieldOrder: [
      'duration_seconds',
      'distance_km',
      'incline_percent',
      'speed_kmh',
      'rest_seconds',
    ],
    prescribedBaseFields: ['rest_seconds'],
    loggedBaseFields: [],
    selectableMetrics: [
      'duration_seconds',
      'distance_km',
      'incline_percent',
      'speed_kmh',
    ],
    selectableIsLoggable: true,
  ),
};

/// Resolves an exercise's category, falling back to the pre-feature default
/// — needed for an ad-hoc catalog-less exercise, or a row written before
/// this feature shipped.
String categoryOf(String? trackingType) =>
    trackingType != null && exerciseCategories.contains(trackingType)
        ? trackingType
        : defaultCategory;

/// The coach's selected optional metrics for an exercise, validated against
/// its category's checklist.
List<String> trackedMetricsOf(String? trackingType, List<String>? trackedMetrics) {
  final category = categoryOf(trackingType);
  final selectable = categoryConfig[category]!.selectableMetrics;
  final raw = trackedMetrics ?? const <String>[];
  return selectable.where(raw.contains).toList();
}

/// Columns to show as prescribed: base prescribed fields + selected metrics
/// (all metrics are prescribed once chosen), in canonical order. Never
/// includes weight.
List<String> prescribedFieldsFor(String? trackingType, List<String>? trackedMetrics) {
  final category = categoryOf(trackingType);
  final cfg = categoryConfig[category]!;
  final selected = trackedMetricsOf(trackingType, trackedMetrics);
  return cfg.fieldOrder
      .where((f) => cfg.prescribedBaseFields.contains(f) || selected.contains(f))
      .toList();
}

/// Editable/loggable columns during a session: base logged fields + selected
/// metrics that are loggable for this category (time_based's, not
/// sets_reps' tempo/rir/rpe).
List<String> loggedFieldsFor(String? trackingType, List<String>? trackedMetrics) {
  final category = categoryOf(trackingType);
  final cfg = categoryConfig[category]!;
  final selected = trackedMetricsOf(trackingType, trackedMetrics);
  final orderedSelected = cfg.selectableIsLoggable
      ? cfg.fieldOrder.where(selected.contains).toList()
      : <String>[];
  return [...cfg.loggedBaseFields, ...orderedSelected];
}

/// Prescribed fields shown as a read-only target during logging (in
/// prescribedFieldsFor but not editable) — e.g. tempo/rir/rpe.
List<String> targetOnlyFieldsFor(String? trackingType, List<String>? trackedMetrics) {
  final logged = loggedFieldsFor(trackingType, trackedMetrics);
  return prescribedFieldsFor(trackingType, trackedMetrics)
      .where((f) => !logged.contains(f))
      .toList();
}
