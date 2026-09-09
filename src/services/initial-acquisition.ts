type AcquisitionClient = {
  functions: { invoke: (name: string, options: { body: Record<string, unknown> }) => PromiseLike<{ data: any; error: any }> };
};
export async function requestInitialAcquisition(client: AcquisitionClient, workspaceId: string, icpId: string, reason: string): Promise<void> {
  const { data, error } = await client.functions.invoke('linkedin-v1-pipeline', {
    body: { action: 'request_replenishment', workspace_id: workspaceId, icp_id: icpId, reason },
  });
  if (error || !data?.job_id) {
    throw new Error('ICP saved and scheduled for automatic retry, but immediate prospecting could not be confirmed. Check ICP & Offers before creating another ICP.');
  }
}
