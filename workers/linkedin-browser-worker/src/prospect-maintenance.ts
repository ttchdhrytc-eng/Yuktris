// Inventory workspaces never flow into LinkedIn execution/account maintenance.
export async function runDueProspectMaintenance(
  client: { rpc: (name: string) => PromiseLike<{ data: any; error: any }> },
  tick: (workspaceId: string) => Promise<void>,
): Promise<void> {
  const { data, error } = await client.rpc('due_prospect_replenishment_workspaces');
  if (error) throw new Error('Unable to load due prospect workspaces: ' + error.message);
  const ids = [...new Set<string>((data ?? []).map((row: { workspace_id: string }) => row.workspace_id))].slice(0, 10);
  for (const workspaceId of ids) await tick(workspaceId);
}
