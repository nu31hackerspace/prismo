import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '@/middleware/require-auth';
import { createEntity, deleteEntity } from '@/entities/entity-service';

export const entitiesRouter = Router();
entitiesRouter.use(requireAuth);

// Generic create for any entity type the client is allowed to originate
// (currently just keyAccess) — createEntity checks that whatever it
// references belongs to the caller's workspace before writing anything.
entitiesRouter.post('/', async (req, res) => {
  const { workspaceId } = req as AuthedRequest;
  const { type, data } = req.body ?? {};
  if (!type || !data) {
    res.status(400).json({ error: 'Missing type or data' });
    return;
  }
  const entity = await createEntity(workspaceId, type, data);
  res.json(entity);
});

// Generic delete for any entity the user owns — deleteEntity checks the id
// belongs to the caller's workspace before touching anything, so this one
// route covers devices, keys, and whatever else becomes deletable later.
entitiesRouter.delete('/:id', async (req, res) => {
  const { workspaceId } = req as AuthedRequest;
  await deleteEntity(workspaceId, req.params.id);
  res.json({ success: true });
});
