import { createServer } from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { parse as parseCookies } from 'cookie';
import { Server } from 'socket.io';

import { migrate } from '@/db/migrate';
import { setBroadcast } from '@/db/mutate';
import { readSnapshot, readDelta } from '@/db/snapshot';
import { resolveSessionFromToken, SESSION_COOKIE } from '@/auth';
import { getWorkspaceForUser } from '@/workspace-service';
import { initializeScanListener } from '@/devices/scan-listener';
import { deviceSession } from '@/middleware/device-session';

import { healthRouter } from '@/routes/health';
import { authRouter } from '@/routes/auth';
import { devicesRouter } from '@/routes/devices';
import { entitiesRouter } from '@/routes/entities';
import { analyticsRouter } from '@/routes/analytics';

const port = parseInt(process.env.PORT || '4000', 10);

async function main() {
  await migrate();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(deviceSession);

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/devices', devicesRouter);
  app.use('/api/entities', entitiesRouter);
  app.use('/api/analytics', analyticsRouter);

  const server = createServer(app);
  const io = new Server(server, { path: '/socket.io' });

  setBroadcast((workspaceId, batch) => {
    io.to(`workspace:${workspaceId}`).emit('sync:batch', batch);
  });

  io.use(async (socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    const token = cookieHeader ? parseCookies(cookieHeader)[SESSION_COOKIE] : undefined;
    const session = await resolveSessionFromToken(token);
    if (!session) return next(new Error('unauthorized'));
    const workspaceId = await getWorkspaceForUser(session.userId);
    if (!workspaceId) return next(new Error('no workspace'));
    socket.data.userId = session.userId;
    socket.data.workspaceId = workspaceId;
    socket.join(`workspace:${workspaceId}`);
    next();
  });

  io.on('connection', (socket) => {
    const { workspaceId } = socket.data;
    socket.on('sync:resync', async ({ seq }: { seq: number }) => {
      const result = seq > 0
        ? { kind: 'delta' as const, batch: await readDelta(workspaceId, seq) }
        : { kind: 'snapshot' as const, snapshot: await readSnapshot(workspaceId) };
      socket.emit('sync:resync-result', result);
    });
  });

  initializeScanListener();

  server.listen(port, '0.0.0.0', () => {
    console.log(`> Backend ready on http://0.0.0.0:${port}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
