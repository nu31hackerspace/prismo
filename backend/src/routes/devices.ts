import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '@/middleware/require-auth';
import {
  triggerDevice,
  generateMqttCredentials,
  forceSyncDevice,
} from '@/devices/device-service';

export const devicesRouter = Router();
devicesRouter.use(requireAuth);

devicesRouter.post('/:deviceId/trigger', async (req, res) => {
  const { workspaceId } = req as AuthedRequest;
  const { action } = req.body ?? {};
  await triggerDevice(req.params.deviceId, workspaceId, action);
  res.json({ success: true });
});

devicesRouter.post('/:deviceId/token', async (req, res) => {
  const { workspaceId } = req as AuthedRequest;
  const token = await generateMqttCredentials(req.params.deviceId, workspaceId);
  res.json({ token });
});

devicesRouter.post('/:deviceId/sync', async (req, res) => {
  const { workspaceId } = req as AuthedRequest;
  await forceSyncDevice(req.params.deviceId, workspaceId);
  res.json({ success: true });
});
