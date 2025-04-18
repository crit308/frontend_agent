import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { connectTutorStream, StreamEvent, onTutorEvent, offTutorEvent } from './wsTutor';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction, type ToastActionElement } from '@/components/ui/toast';

function getAnalysisAction(): ToastActionElement {
  return React.createElement(
    ToastAction as React.ElementType,
    {
      altText: 'Go to analysis',
      onClick: () => { window.location.href = '/analysis'; }
    },
    'Go to analysis'
  ) as ToastActionElement;
}

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

  // Debug overlay state
  const [latency, setLatency] = useState<number | null>(null);
  const [agentTurn, setAgentTurn] = useState<string | null>(null);
  const pingTimestampRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!sessionId || !jwt) return;

    function sendPing() {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        pingTimestampRef.current = Date.now();
        wsRef.current.send(JSON.stringify({ event_type: 'ping' }));
      }
    }

    const connect = () => {
      const ws = connectTutorStream(sessionId, jwt);
      ws.onopen = () => {
        setConnected(true);
        reconnectCountRef.current = 0;
        hasOpenedRef.current = true;
        handlers.onOpen?.();
        // Start ping interval
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(sendPing, 5000);
      };
      ws.onmessage = (msg) => {
        try {
          const event: StreamEvent = JSON.parse(msg.data);
          switch (event.type) {
            case 'pong':
              if (pingTimestampRef.current) {
                setLatency(Date.now() - pingTimestampRef.current);
                pingTimestampRef.current = null;
              }
              break;
            case 'agent_updated_stream_event':
              setAgentTurn(event.agent_turn || '');
              handlers.onAgentUpdated?.(event);
              break;
            case 'raw_response_event':
              handlers.onRawResponse?.(event.data);
              break;
            case 'run_item_stream_event':
              handlers.onRunItem?.(event.item);
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
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (!hasOpenedRef.current) {
          toast({ title: 'Tutor unavailable', description: 'Tutor unavailable – check logs.', variant: 'destructive' });
          return;
        }
        if (ev.code === 1011) {
          toast({
            title: 'Tutor plan failed',
            description: 'The tutor could not generate a plan.',
            variant: 'destructive',
            duration: 10000,
            action: getAnalysisAction(),
          });
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
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [sessionId, jwt, toast]);

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event_type: 'next', data }));
    } else {
      console.warn('[TutorWS] send attempted before open');
    }
  };

  return { connected, send, on: onTutorEvent, off: offTutorEvent, latency, agentTurn };
} 