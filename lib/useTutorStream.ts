import { useEffect, useRef, useState } from 'react';
import { connectTutorStream, StreamEvent, onTutorEvent, offTutorEvent } from './wsTutor';
import { useToast } from '@/components/ui/use-toast';

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
  const hasOpenedRef = useRef(false);
  const reconnectCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!sessionId || !jwt) return;

    const connect = () => {
      const ws = connectTutorStream(sessionId, jwt);
      ws.onopen = () => {
        setConnected(true);
        reconnectCountRef.current = 0;
        hasOpenedRef.current = true;
        handlers.onOpen?.();
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
      ws.onerror = (err) => {
        handlers.onError?.(err);
      };
      ws.onclose = (ev) => {
        setConnected(false);
        handlers.onClose?.(ev);
        if (!hasOpenedRef.current) {
          toast({ title: 'Tutor unavailable', description: 'Tutor unavailable – check logs.', variant: 'destructive' });
          return;
        }
        if (ev.code === 1011) {
          toast({ title: 'Tutor unavailable', description: 'Tutor unavailable – check logs.', variant: 'destructive' });
          return;
        }
        reconnectCountRef.current += 1;
        const delay = Math.min(30000, 1000 * 2 ** reconnectCountRef.current);
        timeoutRef.current = setTimeout(connect, delay);
      };
      wsRef.current = ws;
    };

    connect();

    return () => {
      wsRef.current?.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [sessionId, jwt, toast]);

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event_type: 'next', data }));
    } else {
      console.warn('[TutorWS] send attempted before open');
    }
  };

  return { connected, send, on: onTutorEvent, off: offTutorEvent };
} 