export let workspaceId = '';

export function setWorkspaceId(id: string) {
  workspaceId = id;
}

export const workspaceHeader = () => ({ 'X-Workspace': workspaceId });
