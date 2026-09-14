import { io, Socket } from 'socket.io-client';
import { runInAction } from 'mobx';
import type { ChangeBatch, ResyncRequest, ResyncResult } from '@prismo/shared/sync';
import type { RootStore } from './root-store';

const log = (...args: unknown[]) => console.log('[sync]', ...args);

// Same-origin deployment (Caddy path-routes /socket.io/* to the backend)
// means the browser sends the httpOnly session cookie with the handshake
// automatically — no token to plumb through here.
export function connectSync(store: RootStore): Socket {
  const queue: ChangeBatch[] = [];
  let ready = false;

  const socket = io({
    path: '/socket.io',
    withCredentials: true,
    autoConnect: false,
  });

  // Log every inbound/outbound socket message so the sync protocol is
  // visible in devtools without attaching a debugger.
  socket.onAny((event, ...args) => log('recv', event, ...args));
  socket.onAnyOutgoing((event, ...args) => log('send', event, ...args));

  socket.on('sync:batch', (b: ChangeBatch) => {
    if (ready) store.applyBatch(b);
    else queue.push(b);
  });

  // On every connect (first load and every reconnect alike) ask the server
  // to resync from our last known seq — 0 on first load gets a full
  // snapshot back, anything else gets just the delta.
  socket.on('connect', () => {
    ready = false;
    queue.length = 0;
    socket.emit('sync:resync', { seq: store.entities.lastSeq } satisfies ResyncRequest);
  });

  socket.on('sync:resync-result', (result: ResyncResult) => {
    const resultSeq = result.kind === 'snapshot' ? result.snapshot.seq : result.batch.seq;
    if (result.kind === 'snapshot') store.loadSnapshot(result.snapshot);
    else store.applyBatch(result.batch);

    queue.splice(0)
      .filter(b => b.seq > resultSeq)
      .sort((a, b) => a.seq - b.seq)
      .forEach(b => store.applyBatch(b));
    ready = true;
    runInAction(() => { store.connected = true; });
  });

  socket.on('disconnect', (reason) => {
    log('disconnected', reason);
    ready = false;
    queue.length = 0;
    runInAction(() => { store.connected = false; });
  });

  runInAction(() => { store.socket = socket; });
  socket.connect();
  return socket;
}
