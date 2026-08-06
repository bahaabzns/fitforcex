import { prescribedFieldsFor, loggedFieldsFor, targetOnlyFieldsFor } from '../../src/config/exerciseTrackingTypes';

// Regression test: loggedFieldsFor() used to filter its result through
// fieldOrder (the *prescribed* canonical order), which never included
// "weight" since training_sets has no weight column. That silently dropped
// weight from every logged view (session logging inputs, workout history)
// for every Sets & Reps exercise, regardless of the coach's tracked_metrics.
describe('loggedFieldsFor', () => {
    test('sets_reps always includes weight and reps, regardless of tracked_metrics', () => {
        expect(loggedFieldsFor({ tracking_type: 'sets_reps', tracked_metrics: [] })).toEqual(['weight', 'reps']);
        expect(loggedFieldsFor({ tracking_type: 'sets_reps', tracked_metrics: ['tempo', 'rir', 'rpe'] })).toEqual(['weight', 'reps']);
    });

    test('time_based logs only the coach-selected metrics, in canonical order', () => {
        expect(loggedFieldsFor({ tracking_type: 'time_based', tracked_metrics: [] })).toEqual([]);
        expect(loggedFieldsFor({ tracking_type: 'time_based', tracked_metrics: ['speed_kmh', 'duration_seconds'] }))
            .toEqual(['duration_seconds', 'speed_kmh']); // order follows fieldOrder, not input order
    });

    test('falls back to sets_reps for an ad-hoc exercise with no tracking_type', () => {
        expect(loggedFieldsFor(null)).toEqual(['weight', 'reps']);
        expect(loggedFieldsFor(undefined)).toEqual(['weight', 'reps']);
    });
});

describe('prescribedFieldsFor', () => {
    test('sets_reps never includes weight (training_sets has no weight column)', () => {
        const fields = prescribedFieldsFor({ tracking_type: 'sets_reps', tracked_metrics: ['tempo', 'rir', 'rpe'] });
        expect(fields).not.toContain('weight');
        expect(fields).toEqual(['reps', 'rest_seconds', 'tempo', 'rir', 'rpe']);
    });

    test('time_based always includes rest_seconds plus selected metrics', () => {
        expect(prescribedFieldsFor({ tracking_type: 'time_based', tracked_metrics: ['distance_km'] }))
            .toEqual(['distance_km', 'rest_seconds']);
    });
});

describe('targetOnlyFieldsFor', () => {
    test('sets_reps: tempo/rir/rpe are targets (prescribed but not logged); reps is not (it is both)', () => {
        const fields = targetOnlyFieldsFor({ tracking_type: 'sets_reps', tracked_metrics: ['tempo', 'rir', 'rpe'] });
        expect(fields.sort()).toEqual(['rest_seconds', 'rir', 'rpe', 'tempo'].sort());
    });

    test('time_based: rest_seconds is the only target-only field (prescribed base, but not a loggable metric)', () => {
        expect(targetOnlyFieldsFor({ tracking_type: 'time_based', tracked_metrics: ['duration_seconds', 'distance_km'] }))
            .toEqual(['rest_seconds']);
    });
});
