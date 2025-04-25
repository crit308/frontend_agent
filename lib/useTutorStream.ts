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
      onClick: () => { window.location.href = `/session/${useSessionStore.getState().sessionId}/analysis`; }
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
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const hasAttemptedConnectionRef = useRef(false);
  const isComponentMountedRef = useRef(true);
  const { toast } = useToast();
  const [latency, setLatency] = useState<number | null>(null);
  const pingTimestampRef = useRef<number | null>(null);

  // --- Use stable references for store actions ---
  const registerWebSocketSend = useSessionStore.getState().registerWebSocketSend;
  const deregisterWebSocketSend = useSessionStore.getState().deregisterWebSocketSend;
  const setSessionState = useSessionStore.setState;
  const getState = useSessionStore.getState;

  // Stable send function
  const sendMessage = useCallback((payload: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageString = JSON.stringify(payload);
      console.log('[TutorWS Hook] Sending message:', messageString);
      try { wsRef.current.send(messageString); } catch (e) { console.error("[WebSocket] Error sending message:", e); handlers.onError?.(e); }
    } else {
      console.warn('[TutorWS Hook] send attempted when WS not open');
      handlers.onError?.(new Error("WebSocket disconnected. Cannot send message."));
    }
  }, [handlers]);

  // --- Connection Logic wrapped in useCallback ---
  const connect = useCallback(() => {
    if (!isComponentMountedRef.current) {
      console.log('[WebSocket] connect called but component is unmounted. Aborting.');
      return;
    }
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      console.log('[WebSocket] Connect called but already open/connecting.');
      return;
    }
    // Clean up previous socket instance rigorously
    if (wsRef.current) {
      console.log("[WebSocket] Cleaning up previous socket before new connection.");
      wsRef.current.onclose = null; wsRef.current.onerror = null; wsRef.current.onmessage = null; wsRef.current.onopen = null;
      try { if (wsRef.current.readyState !== WebSocket.CLOSED) wsRef.current.close(1000, "Starting new connection"); } catch (e) { console.warn("Error closing previous socket:", e); }
      wsRef.current = null;
    }
    console.log(`[WebSocket] Attempting connection... (Attempt: ${reconnectAttemptsRef.current + 1})`);
    hasAttemptedConnectionRef.current = true;
    const ws = connectTutorStream(sessionId, jwt);
    wsRef.current = ws;
    ws.onopen = () => {
      if (wsRef.current !== ws) { console.log("[WebSocket] Ignoring open event from stale connection."); ws.close(1000, "Stale connection"); return; }
      console.log(`[WebSocket] Connection OPENED for session: ${sessionId}`);
      reconnectAttemptsRef.current = 0;
      setConnected(true);
      handlers.onOpen?.();
      console.log('[WebSocket] Registering send function with store.');
      registerWebSocketSend(sendMessage);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
          pingTimestampRef.current = Date.now();
          try { ws.send(JSON.stringify({ type: 'ping' })); } catch (e) { console.error("[WebSocket] Error sending ping:", e); }
        } else if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
      }, 5000);
      setTimeout(() => {
        if (wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
          console.log("[WebSocket] Sending initial 'user_message' (start)...");
          try { sendMessage({ type: 'user_message', data: { text: 'Start the lesson.' } }); console.log("[WebSocket] Initial 'user_message' sent successfully."); }
          catch (e) { console.error("[WebSocket] Error sending initial 'user_message':", e); handlers.onError?.(e); }
        }
      }, 100);
    };
    ws.onerror = (error) => {
      console.error(`[WebSocket] Error on socket for session ${sessionId}:`, error);
      if (wsRef.current === ws) { handlers.onError?.(error); }
      else { console.log("[WebSocket] Ignoring error from stale connection attempt."); }
    };
    ws.onclose = (event) => {
      if (wsRef.current !== ws) { console.log(`[WebSocket] Ignoring close event from STALE socket instance for session ${sessionId}.`); return; }
      console.log(`[WebSocket] Connection CLOSED for session ${sessionId}: Code=${event.code}, Reason='${event.reason}'`);
      wsRef.current = null;
      setConnected(false);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current); pingIntervalRef.current = null;
      handlers.onClose?.(event);
      if (!isComponentMountedRef.current) { console.log('[WebSocket] Connection closed & component unmounted. Not reconnecting.'); return; }
      if (event.code !== 1000 && event.code !== 1011) {
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(15000, 1000 * 2 ** reconnectAttemptsRef.current);
        console.log(`[WebSocket] Scheduling reconnect after ${delay}ms... (Attempt ${reconnectAttemptsRef.current})`);
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (isComponentMountedRef.current) { connect(); }
          else { console.log('[WebSocket] Reconnect timer fired, but component unmounted.'); }
        }, delay);
      }
      else if (event.code === 1011) { toast({ title: 'Tutor Error', description: 'The tutor encountered an internal issue.', variant: 'destructive', duration: 10000 }); }
      else if (hasAttemptedConnectionRef.current && !connected && event.code !== 1000) { toast({ title: 'Tutor unavailable', description: 'Initial connection failed.', variant: 'destructive' }); }
    };
    ws.onmessage = (event) => {
      if (wsRef.current !== ws) { return; }
      let parsedData; try { parsedData = JSON.parse(event.data); } catch (e) { console.error('[WS] message parse error', e); handlers.onError?.(e); return; }
      let mainPayload = null, userModelState = null;
      if (parsedData?.content_type && parsedData.data && parsedData.user_model_state) { mainPayload = parsedData.data; userModelState = parsedData.user_model_state; handlers.onInteractionResponse?.(parsedData); }
      else if (parsedData?.response_type) { mainPayload = parsedData; handlers.onInteractionResponse?.({ content_type: parsedData.response_type, data: mainPayload, user_model_state: null }); }
      else if (parsedData?.type === 'raw_delta') { handlers.onRawResponse?.(parsedData.delta); }
      else if (parsedData?.type) { switch (parsedData.type) { case 'pong': if(pingTimestampRef.current){setLatency(Date.now()-pingTimestampRef.current); pingTimestampRef.current=null;} break; case 'ack': console.debug('ack'); break; default: handlers.onUnhandled?.(parsedData);}}
      else { console.error('[WS] Received unknown message structure:', parsedData); handlers.onError?.(new Error("Unknown message format"));}
      if(mainPayload){ const currentStoreState = getState(); const newState:Partial<any>={currentInteractionContent:mainPayload,loadingState:'idle',loadingMessage:'',error: mainPayload.response_type === 'error' ? mainPayload.message : currentStoreState.error}; if(userModelState){newState.userModelState = userModelState;} setSessionState({...currentStoreState, ...newState});}
    };
    if (wsRef.current !== ws) {
      console.warn("[WebSocket] wsRef.current was potentially overwritten immediately after creation. Race condition?");
    }
  }, [sessionId, jwt, handlers, registerWebSocketSend, sendMessage, toast, setSessionState, getState]);

  useEffect(() => {
    isComponentMountedRef.current = true;
    console.log("[WebSocket] Mount effect running. Attempting initial connect.");
    if (sessionId && jwt) {
      hasAttemptedConnectionRef.current = false;
      reconnectAttemptsRef.current = 0;
      connect();
    }
    return () => {
      isComponentMountedRef.current = false;
      console.log(`[WebSocket] Unmount cleanup for session: ${sessionId}`);
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
      const wsInstance = wsRef.current;
      if (wsInstance) {
        console.log(`[WebSocket] Closing socket (state: ${wsInstance.readyState}) in unmount cleanup.`);
        wsInstance.onclose = null; wsInstance.onerror = null; wsInstance.onmessage = null; wsInstance.onopen = null;
        try {
          if (wsInstance.readyState === WebSocket.OPEN || wsInstance.readyState === WebSocket.CONNECTING) {
            wsInstance.close(1000, "Component unmounting");
          }
        } catch (e) { console.warn("Error during cleanup close:", e)}
      }
      wsRef.current = null;
      console.log('[WebSocket] Deregistering send function on unmount.');
      deregisterWebSocketSend();
    };
  }, [sessionId, jwt, connect, deregisterWebSocketSend]);

  return { connected, send: sendMessage, on: onTutorEvent, off: offTutorEvent, latency };
} 