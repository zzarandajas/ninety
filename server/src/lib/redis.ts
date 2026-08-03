import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export interface RealtimeEvent {
  type: string;
  entity: string;
  action: string;
  id?: string;
  tenantId: string;
  senderUserId?: string;
  payload?: Record<string, unknown>;
  timestamp?: number;
}

type EventListener = (event: RealtimeEvent) => void;

let pubClient: Redis | null = null;
let subClient: Redis | null = null;

const eventListeners: EventListener[] = [];

export function getRedisClients() {
  if (!pubClient) {
    pubClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      lazyConnect: false,
    });
    pubClient.on('error', (err) => {
      console.error('[Redis Pub Error]', err.message);
    });
  }

  if (!subClient) {
    subClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      lazyConnect: false,
    });
    subClient.on('error', (err) => {
      console.error('[Redis Sub Error]', err.message);
    });

    subClient.psubscribe('tenant:*:events', (err) => {
      if (err) {
        console.error('[Redis psubscribe error]', err);
      }
    });

    subClient.on('pmessage', (_pattern, channel, message) => {
      try {
        const event: RealtimeEvent = JSON.parse(message);
        for (const listener of eventListeners) {
          listener(event);
        }
      } catch (e) {
        console.error('[Redis message parse error]', e);
      }
    });
  }

  return { pubClient, subClient };
}

export function subscribeToRealtimeEvents(listener: EventListener): () => void {
  getRedisClients();
  eventListeners.push(listener);
  return () => {
    const idx = eventListeners.indexOf(listener);
    if (idx !== -1) {
      eventListeners.splice(idx, 1);
    }
  };
}

export async function publishTenantEvent(event: RealtimeEvent): Promise<void> {
  const { pubClient } = getRedisClients();
  const channel = `tenant:${event.tenantId}:events`;
  const messageData = JSON.stringify({
    ...event,
    timestamp: event.timestamp || Date.now(),
  });
  try {
    await pubClient.publish(channel, messageData);
  } catch (err) {
    console.error('[Redis publish error]', err);
  }
}

export async function closeRedisClients(): Promise<void> {
  if (pubClient) {
    await pubClient.quit().catch(() => {});
    pubClient = null;
  }
  if (subClient) {
    await subClient.quit().catch(() => {});
    subClient = null;
  }
}
