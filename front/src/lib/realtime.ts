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

type EventCallback = (event: RealtimeEvent) => void;

class RealtimeClient {
  private socket: WebSocket | null = null;
  private listeners: Set<EventCallback> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private currentToken: string | null = null;
  private currentTenantId: string | null = null;
  private reconnectDelay = 1000;
  private isExplicitlyClosed = false;

  public connect(token: string, tenantId: string) {
    if (
      this.socket &&
      this.currentToken === token &&
      this.currentTenantId === tenantId &&
      (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.disconnect();
    this.currentToken = token;
    this.currentTenantId = tenantId;
    this.isExplicitlyClosed = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws?token=${encodeURIComponent(token)}&tenantId=${encodeURIComponent(tenantId)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectDelay = 1000;
        this.startPing();
      };

      this.socket.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          const parsed: RealtimeEvent = JSON.parse(event.data);
          this.listeners.forEach((callback) => callback(parsed));
        } catch {
          // ignore non-json messages
        }
      };

      this.socket.onclose = () => {
        this.stopPing();
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = () => {
        this.socket?.close();
      };
    } catch (err) {
      console.error('[RealtimeClient connection error]', err);
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
  }

  public subscribe(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send('ping');
      }
    }, 25000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.isExplicitlyClosed) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      if (this.currentToken && this.currentTenantId) {
        this.connect(this.currentToken, this.currentTenantId);
      }
    }, this.reconnectDelay);
  }
}

export const realtimeClient = new RealtimeClient();
