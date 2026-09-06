import assert from 'node:assert/strict';
import { nextAcquisitionCadence } from '../supabase/functions/_shared/prospectAcquisition.ts';

const base = { minimum_ready_inventory: 5, acquisition_phase: 'initial_acquisition', starter_ready_target: 3, max_initial_acquisition_batches: 3, initial_acquisition_interval_minutes: 10 };

assert.deepEqual(nextAcquisitionCadence({ ...base, initial_acquisition_batches_completed: 0 }, 0), { phase: 'initial_acquisition', initialBatchesCompleted: 1, delayMinutes: 10 });
assert.deepEqual(nextAcquisitionCadence({ ...base, initial_acquisition_batches_completed: 1 }, 0), { phase: 'initial_acquisition', initialBatchesCompleted: 2, delayMinutes: 10 });
assert.deepEqual(nextAcquisitionCadence({ ...base, initial_acquisition_batches_completed: 2 }, 0), { phase: 'maintenance', initialBatchesCompleted: 3, delayMinutes: 360 });
assert.deepEqual(nextAcquisitionCadence({ ...base, initial_acquisition_batches_completed: 0 }, 3), { phase: 'maintenance', initialBatchesCompleted: 1, delayMinutes: 360 });
assert.deepEqual(nextAcquisitionCadence({ ...base, acquisition_phase: 'maintenance', initial_acquisition_batches_completed: 3 }, 5), { phase: 'maintenance', initialBatchesCompleted: 3, delayMinutes: 1440 });
console.log('PASS initial acquisition cadence: bounded short intervals, max transition, starter transition, maintenance cadence');
