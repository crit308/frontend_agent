import { useEffect, useRef, useState } from 'react';
import { connectTutorStream, StreamEvent } from './wsTutor';

export interface TutorStreamHandlers {
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (err: Event | any) => void;
  onRawResponse?: (delta: any) => void;
  onRunItem?: (item: any) => void;
  onAgentUpdated?: (event: any) => void;
  onUnhandled?: (event: any) => void;
}

export function useTutorStream(
  sessionId: string,
  jwt: string,
  handlers: TutorStreamHandlers = {}
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionId || !jwt) return;

    const ws = connectTutorStream(sessionId, jwt);
    ws.onopen = () => {
      setConnected(true);
      handlers.onOpen?.();
    };
    ws.onclose = (ev) => {
      setConnected(false);
      handlers.onClose?.(ev);
    };
    ws.onerror = (err) => {
      handlers.onError?.(err);
    };
    ws.onmessage = (msg) => {
      try {
        const event: StreamEvent = JSON.parse(msg.data);
        switch (event.type) {
          case 'raw_response_event':
            handlers.onRawResponse?.(event.data);
            break;
          case 'run_item_stream_event':
            handlers.onRunItem?.(event.item);
            break;
          case 'agent_updated_stream_event':
            handlers.onAgentUpdated?.(event);
            break;
          case 'error':
            handlers.onError?.(event.detail);
            break;
          default:
            handlers.onUnhandled?.(event);
            break;
        }
      } catch (e) {
        console.error('[TutorWS] message parse error', e);
      }
    };
    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [sessionId, jwt]);

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'next', data }));
    } else {
      console.warn('[TutorWS] send attempted before open');
    }
  };

  return { connected, send };
} 