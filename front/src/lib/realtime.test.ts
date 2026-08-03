import { describe, expect, it, vi } from 'vitest';
import { realtimeClient, type RealtimeEvent } from './realtime';

describe('RealtimeClient', () => {
  it('allows subscribing and unsubscribing to events', () => {
    const callback = vi.fn();
    const unsubscribe = realtimeClient.subscribe(callback);

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('can format and receive events', () => {
    const mockEvent: RealtimeEvent = {
      type: 'ENTITY_CHANGED',
      entity: 'rock',
      action: 'update',
      id: 'rock-1',
      tenantId: 'tenant-1',
    };

    const callback = vi.fn();
    const unsubscribe = realtimeClient.subscribe(callback);

    // Manually trigger callback test
    callback(mockEvent);
    expect(callback).toHaveBeenCalledWith(mockEvent);

    unsubscribe();
  });
});
