import { useEffect, useRef, useCallback, useState } from 'react';

interface UseWebSocketOptions {
  topic?: string;
  topics?: string[];
  onMessage: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: unknown | null;
  unsubscribe: () => void;
}

export function useWebSocket({
  topic: singleTopic,
  topics,
  onMessage,
  onConnect,
  onDisconnect,
  enabled = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  // Support both topic (string) and topics (string[]) — merge into one
  const topic = singleTopic || (topics && topics.length > 0 ? topics[0] : '');
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const clientRef = useRef<{ deactivate: () => void } | null>(null);

  const disconnect = useCallback(() => {
    try {
      clientRef.current?.deactivate();
    } catch {
      // ignore
    }
    clientRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled || !topic) return;

    let cancelled = false;

    // Dynamically import SockJS + STOMP only when needed
    const connect = async () => {
      try {
        const [{ Client }, SockJSModule] = await Promise.all([
          import('@stomp/stompjs'),
          import('sockjs-client'),
        ]);

        if (cancelled) return;

        const SockJS = SockJSModule.default;
        const wsUrl = `${window.location.protocol}//${window.location.host}/ws`;

        const client = new Client({
          webSocketFactory: () => new SockJS(wsUrl) as WebSocket,
          reconnectDelay: 5000,
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
          onConnect: () => {
            if (cancelled) return;
            setIsConnected(true);
            onConnect?.();

            client.subscribe(topic, (message) => {
              try {
                const data = JSON.parse(message.body);
                setLastMessage(data);
                onMessageRef.current(data);
              } catch {
                onMessageRef.current(message.body);
              }
            });
          },
          onDisconnect: () => {
            if (cancelled) return;
            setIsConnected(false);
            onDisconnect?.();
          },
          onStompError: (frame) => {
            console.warn('STOMP error:', frame.headers['message']);
            setIsConnected(false);
          },
          onWebSocketError: () => {
            // Silently handle — WebSocket might not be available
            setIsConnected(false);
          },
        });

        client.activate();
        clientRef.current = client;
      } catch (err) {
        // WebSocket not available — silently skip
        console.warn('WebSocket connection skipped:', err);
      }
    };

    connect();

    return () => {
      cancelled = true;
      disconnect();
    };
  }, [topic, enabled, onConnect, onDisconnect, disconnect]);

  return { isConnected, lastMessage, unsubscribe: disconnect };
}

// Convenience hooks
export function useDeviceTelemetry(agentId: string | null, onTelemetry: (data: unknown) => void, enabled = true) {
  return useWebSocket({ topic: `/topic/telemetry/${agentId}`, onMessage: onTelemetry, enabled: enabled && !!agentId });
}

export function useDeviceStatusUpdates(onStatusChange: (data: unknown) => void, enabled = true) {
  return useWebSocket({ topic: '/topic/device-status', onMessage: onStatusChange, enabled });
}

export function useIssueUpdates(onIssueUpdate: (data: unknown) => void, enabled = true) {
  return useWebSocket({ topic: '/topic/issues', onMessage: onIssueUpdate, enabled });
}

export function useDashboardUpdates(onDashboardUpdate: (data: unknown) => void, enabled = true) {
  return useWebSocket({ topic: '/topic/dashboard', onMessage: onDashboardUpdate, enabled });
}
