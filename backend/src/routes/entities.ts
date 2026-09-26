import { Router } from 'express';
import { requireAuth, authContext } from '@/middleware/require-auth';
import { createEntity, deleteEntity } from '@/entities/entity-service';
import { EntityError } from '@/entities/entity-error';

export const entitiesRouter = Router();
entitiesRouter.use(requireAuth);

entitiesRouter.post('/', async (req, res) => {
  const { workspaceId } = authContext(req);
  const { type, data } = req.body ?? {};
  try {
    res.json(await createEntity(workspaceId, type, data));
  } catch (err) {
    if (err instanceof EntityError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

entitiesRouter.delete('/:id', async (req, res) => {
  const { workspaceId } = authContext(req);
  try {
    await deleteEntity(workspaceId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof EntityError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});
