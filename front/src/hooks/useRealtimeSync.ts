import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { realtimeClient, type RealtimeEvent } from '../lib/realtime';

export function useRealtimeSync(onEvent?: (event: RealtimeEvent) => void) {
  const token = useAuthStore((state) => state.token);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);

  useEffect(() => {
    if (token && activeTenantId) {
      realtimeClient.connect(token, activeTenantId);
    } else {
      realtimeClient.disconnect();
    }
  }, [token, activeTenantId]);

  useEffect(() => {
    if (!onEvent) return;
    const unsubscribe = realtimeClient.subscribe(onEvent);
    return () => {
      unsubscribe();
    };
  }, [onEvent]);
}
