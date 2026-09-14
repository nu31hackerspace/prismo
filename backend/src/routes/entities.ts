import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '@/middleware/require-auth';
import { createEntity, deleteEntity } from '@/entities/entity-service';

export const entitiesRouter = Router();
entitiesRouter.use(requireAuth);

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

entitiesRouter.delete('/:id', async (req, res) => {
  const { workspaceId } = req as AuthedRequest;
  await deleteEntity(workspaceId, req.params.id);
  res.json({ success: true });
});
