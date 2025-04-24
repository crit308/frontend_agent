import React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { connectTutorStream, StreamEvent, onTutorEvent, offTutorEvent } from './wsTutor';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction, type ToastActionElement } from '@/components/ui/toast';
import { useSessionStore } from '@/store/sessionStore';

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
  onInteractionResponse?: (response: any) => void;
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

  // Get store actions (safe outside useEffect as actions don't change)
  const { registerWebSocketSend, deregisterWebSocketSend, setError, setLoading } = useSessionStore.getState();

  // --- Define the send function using useCallback for stability ---
  const sendMessage = useCallback((payload: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageString = JSON.stringify(payload);
      console.log('[TutorWS Hook] Sending message:', messageString);
      wsRef.current.send(messageString);
    } else {
      console.warn('[TutorWS Hook] send attempted when WS not open');
      setError("WebSocket disconnected. Cannot send message.");
      setLoading('error');
    }
  }, [setError, setLoading]);

  const hasSentStartRef = useRef(false);

  useEffect(() => {
    // Only run if sessionId and jwt are available
    if (!sessionId || !jwt) {
      console.log('[WebSocket] Missing sessionId or token, not connecting.');
      return;
    }

    // Prevent multiple connections
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Connection already open.');
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Connection already in progress.');
      return;
    }

    console.log(`[WebSocket] Attempting to connect for session: ${sessionId}...`);
    // Use your connectTutorStream function to get the correct URL
    const ws = connectTutorStream(sessionId, jwt);
    wsRef.current = ws;
    hasSentStartRef.current = false;

    ws.onopen = () => {
      console.log(`[WebSocket] Connection OPENED for session: ${sessionId}`);
      setConnected(true);
      reconnectCountRef.current = 0;
      hasOpenedRef.current = true;
      handlers.onOpen?.();
      // Start ping interval
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          pingTimestampRef.current = Date.now();
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 5000);
      // Register the send function with the store
      console.log('[WebSocket] Registering send function with store.');
      registerWebSocketSend(sendMessage);
      if (!hasSentStartRef.current) {
        console.log("[WebSocket] Sending 'start' message...");
        try {
          ws.send(JSON.stringify({ type: 'start', data: {} }));
          console.log("[WebSocket] 'start' message sent successfully.");
          hasSentStartRef.current = true;
        } catch (e) {
          console.error("[WebSocket] Error sending 'start' message:", e);
          hasSentStartRef.current = false;
        }
      } else {
        console.log("[WebSocket] 'start' message already sent for this connection.");
      }
    };

    ws.onerror = (error) => {
      console.error(`[WebSocket] Error for session ${sessionId}:`, error);
      wsRef.current = null;
    };

    ws.onclose = (event) => {
      console.log(`[WebSocket] Connection CLOSED for session ${sessionId}: Code=${event.code}, Reason='${event.reason}'`);
      setConnected(false);
      wsRef.current = null;
      hasSentStartRef.current = false;
      handlers.onClose?.(event);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      // Deregister send function
      console.log('[WebSocket] Deregistering send function (onclose).');
      deregisterWebSocketSend();
      if (!hasOpenedRef.current) {
        toast({ title: 'Tutor unavailable', description: 'Tutor unavailable – check logs.', variant: 'destructive' });
        return;
      }
      if (event.code === 1011) {
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
      timeoutRef.current = setTimeout(() => {
        console.log(`[WebSocket] Reconnecting after ${delay}ms...`);
        // Reconnect logic will be handled by effect re-run
      }, delay);
    };

    ws.onmessage = (event) => {
      console.log(`[WebSocket] Message received for ${sessionId}:`, event.data);
      let parsedData;
      try {
        parsedData = JSON.parse(event.data);
        console.log('[WebSocket] Parsed message:', parsedData);
      } catch (e) {
        console.error('[WebSocket] message parse error', e);
        return;
      }

      // --- REVISED: Handle InteractionResponseData OR Direct Payloads ---
      let mainPayload = null;
      let userModelState = null;

      // Check if it's the full InteractionResponseData wrapper
      if (parsedData && parsedData.content_type && parsedData.data && parsedData.user_model_state) {
         mainPayload = parsedData.data;
         userModelState = parsedData.user_model_state;
         console.log(`[WebSocket] Handling InteractionResponseData: ${parsedData.content_type}`);
         // --- NEW: Call the structured response handler ---
         if (handlers.onInteractionResponse) {
             handlers.onInteractionResponse(parsedData); // Pass the whole wrapper
         }
      }
      // Check if it's a direct payload (like the error might be)
      else if (parsedData && parsedData.response_type) {
          mainPayload = parsedData; // Assume it's the main payload directly
          // User model state might not be present in direct error messages
          console.log(`[WebSocket] Handling direct response_type: ${parsedData.response_type}`);
      }

      // If we identified a main payload, update the store
      if (mainPayload) {
           const newState: Partial<import('@/store/sessionStore').SessionState> = {
                currentInteractionContent: mainPayload,
                loadingState: 'idle',
                loadingMessage: '',
                error: mainPayload.response_type === 'error' ? mainPayload.message : null
           };
           if (userModelState) {
               newState.userModelState = userModelState;
           }
           useSessionStore.setState(newState);
           console.log('[WebSocket] Store updated with main payload.');
      }
      // --- Handle Custom Raw Deltas ---
      else if (parsedData && parsedData.type === 'raw_delta') {
         console.debug('[WebSocket] Handling raw_delta');
         handlers.onRawResponse?.(parsedData.delta);
      // --- Handle Other Top-Level Types (Ping, Ack, etc.) ---
      } else if (parsedData && parsedData.type) {
        const evt = parsedData;
        switch (evt.type) {
          case 'pong':
             if (pingTimestampRef.current) {
                 setLatency(Date.now() - pingTimestampRef.current);
                 pingTimestampRef.current = null;
             }
             break;
          case 'ack':
            console.debug('[WebSocket] Received ack:', evt.detail);
            break;
          // Add cases for AgentUpdatedStreamEvent, etc. if needed
          default:
            console.warn('[WebSocket] Unhandled top-level type:', evt.type, evt);
            handlers.onUnhandled?.(evt);
            break;
        }
      } else {
        console.error('[WebSocket] Received message without known structure:', parsedData);
      }
    };

    // Cleanup function
    return () => {
      console.log(`[WebSocket] Cleanup effect for session: ${sessionId}`);
      hasSentStartRef.current = false;
      if (wsRef.current) {
        console.log(`[WebSocket] Closing socket explicitly in cleanup. ReadyState: ${wsRef.current.readyState}`);
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close(1000, "Component unmounting or dependency change");
        }
        wsRef.current = null;
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      // Deregister send function on unmount
      console.log('[WebSocket] Deregistering send function (unmount).');
      deregisterWebSocketSend();
    };
  }, [sessionId, jwt]);

  // Return connection state, event handlers, and debug info
  return { connected, send: sendMessage, on: onTutorEvent, off: offTutorEvent, latency, agentTurn };
} 