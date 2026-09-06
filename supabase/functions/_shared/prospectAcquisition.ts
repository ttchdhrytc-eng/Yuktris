export type AcquisitionConfig = {
  minimum_ready_inventory?: number | null;
  acquisition_phase?: string | null;
  initial_acquisition_batches_completed?: number | null;
  starter_ready_target?: number | null;
  max_initial_acquisition_batches?: number | null;
  initial_acquisition_interval_minutes?: number | null;
};

export type AcquisitionCadence = {
  phase: 'initial_acquisition' | 'maintenance';
  initialBatchesCompleted: number;
  delayMinutes: number;
};

export function nextAcquisitionCadence(config: AcquisitionConfig, readyCount: number): AcquisitionCadence {
  const wasInitial = config.acquisition_phase === 'initial_acquisition';
  const initialBatchesCompleted = wasInitial ? Number(config.initial_acquisition_batches_completed ?? 0) + 1 : Number(config.initial_acquisition_batches_completed ?? 0);
  const starterReached = readyCount >= Number(config.starter_ready_target ?? 3);
  const initialLimitReached = initialBatchesCompleted >= Number(config.max_initial_acquisition_batches ?? 3);
  if (wasInitial && !starterReached && !initialLimitReached) {
    return { phase: 'initial_acquisition', initialBatchesCompleted, delayMinutes: Number(config.initial_acquisition_interval_minutes ?? 10) };
  }
  return { phase: 'maintenance', initialBatchesCompleted, delayMinutes: readyCount < Number(config.minimum_ready_inventory ?? 5) ? 360 : 1440 };
}
