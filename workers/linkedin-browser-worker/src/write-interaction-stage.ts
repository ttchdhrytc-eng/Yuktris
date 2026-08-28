export const WRITE_INTERACTION_STAGES = [
  'not_started',
  'profile_verified',
  'relationship_verified',
  'connect_control_resolved',
  'before_connect_click',
  'connect_clicked',
  'confirmation_present',
  'before_confirmation_click',
  'confirmation_click_attempted',
  'confirmation_clicked',
  'before_message_send',
  'message_send_attempted',
  'message_sent',
  'post_write_verification',
  'terminal',
] as const;

export type WriteInteractionStage = typeof WRITE_INTERACTION_STAGES[number];

const POTENTIALLY_EXTERNAL = new Set<WriteInteractionStage>([
  'before_connect_click',
  'connect_clicked',
  'confirmation_present',
  'before_confirmation_click',
  'confirmation_click_attempted',
  'confirmation_clicked',
  'before_message_send',
  'message_send_attempted',
  'message_sent',
  'post_write_verification',
  'terminal',
]);

export function hasPotentialExternalEffect(stage: WriteInteractionStage): boolean {
  return POTENTIALLY_EXTERNAL.has(stage);
}

export function failureOutcomeForStage(stage: WriteInteractionStage, error: string): Record<string, unknown> {
  const crossed = hasPotentialExternalEffect(stage);
  return crossed
    ? { result_code: 'outcome_unknown', write_verified: false, retry_allowed: false, interaction_crossed: true, interaction_stage: stage, error }
    : { result_code: 'failed', write_verified: false, retry_allowed: true, interaction_crossed: false, interaction_stage: stage, error };
}
