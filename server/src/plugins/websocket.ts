import websocketPlugin, { type SocketStream } from '@fastify/websocket';
import fp from 'fastify-plugin';
import type { WebSocket } from 'ws';
import { prisma } from '../lib/prisma.js';
import { RealtimeEvent, subscribeToRealtimeEvents } from '../lib/redis.js';

// Connection registry: tenantId -> Set<WebSocket>
const tenantSocketsMap = new Map<string, Set<WebSocket>>();

function addSocket(tenantId: string, socket: WebSocket) {
  let sockets = tenantSocketsMap.get(tenantId);
  if (!sockets) {
    sockets = new Set();
    tenantSocketsMap.set(tenantId, sockets);
  }
  sockets.add(socket);
}

function removeSocket(tenantId: string, socket: WebSocket) {
  const sockets = tenantSocketsMap.get(tenantId);
  if (sockets) {
    sockets.delete(socket);
    if (sockets.size === 0) {
      tenantSocketsMap.delete(tenantId);
    }
  }
}

// Broadcast event to all sockets of a tenant
function broadcastToTenant(event: RealtimeEvent) {
  const sockets = tenantSocketsMap.get(event.tenantId);
  if (!sockets || sockets.size === 0) return;

  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === 1 /* WebSocket.OPEN */) {
      try {
        socket.send(payload);
      } catch (err) {
        console.error('[WS broadcast error]', err);
      }
    }
  }
}

// Listen to Redis Pub/Sub events
subscribeToRealtimeEvents((event) => {
  broadcastToTenant(event);
});

export default fp(async (app) => {
  await app.register(websocketPlugin);

  app.get('/ws', { websocket: true }, async (connection: SocketStream, req) => {
    const socket: WebSocket = connection.socket;
    const query = (req.query || {}) as { token?: string; tenantId?: string };

    const token = query.token;
    const tenantId = query.tenantId;

    if (!token || !tenantId) {
      socket.send(JSON.stringify({ error: 'Missing token or tenantId' }));
      socket.close(4001, 'Unauthorized');
      return;
    }

    let userId: string;
    try {
      const decoded = app.jwt.verify<{ userId: string }>(token);
      userId = decoded.userId;
    } catch {
      socket.send(JSON.stringify({ error: 'Invalid token' }));
      socket.close(4001, 'Unauthorized');
      return;
    }

    try {
      const membership = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      });

      if (!membership || membership.isActive === false) {
        socket.send(JSON.stringify({ error: 'No access to tenant' }));
        socket.close(4003, 'Forbidden');
        return;
      }
    } catch (err) {
      console.error('[WS auth error]', err);
      socket.close(4500, 'Server error');
      return;
    }

    // Auth succeeded! Add socket to tenant pool
    addSocket(tenantId, socket);

    // Ping/pong or heartbeat support
    socket.on('message', (msg: Buffer | string) => {
      try {
        const text = msg.toString();
        if (text === 'ping') {
          socket.send('pong');
        }
      } catch {
        // ignore
      }
    });

    socket.on('close', () => {
      removeSocket(tenantId, socket);
    });

    socket.on('error', () => {
      removeSocket(tenantId, socket);
    });
  });
});
