import React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { connectTutorStream, StreamEvent, onTutorEvent, offTutorEvent } from './wsTutor';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction, type ToastActionElement } from '@/components/ui/toast';
import { useSessionStore } from '@/store/sessionStore';

// Define more specific connection status types
type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'auth_error';

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
  onInteractionResponse?: (response: { content_type: string; data: any; user_model_state: any }) => void;
}

export function useTutorStream(
  sessionId: string,
  jwt: string,
  handlers: TutorStreamHandlers = {}
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // --- Helper to update both local and store state ---
  const updateStatus = useCallback((status: ConnectionStatus, errorInfo?: { message: string; code?: string }) => {
    if (!isComponentMountedRef.current) return;
    setConnectionStatus(status);
    const storeUpdate: Partial<any> = { connectionStatus: status };
    if (status === 'error' || status === 'auth_error') {
      storeUpdate.error = errorInfo || { message: 'Connection error' };
      storeUpdate.loadingState = 'idle';
    }
    setSessionState(storeUpdate);
  }, [setSessionState]);

  // Use a ref to hold the latest connectionStatus so the callback stays stable
  const connectionStatusRef = useRef<ConnectionStatus>('idle');
  useEffect(() => { connectionStatusRef.current = connectionStatus; }, [connectionStatus]);

  const sendMessage = useCallback((payload: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageString = JSON.stringify(payload);
      console.log('[TutorWS Hook] Sending message:', messageString);
      try { wsRef.current.send(messageString); } catch (e) {
        console.error("[WebSocket] Error sending message:", e);
        handlers.onError?.(e);
      }
    } else {
      console.warn('[TutorWS Hook] send attempted when WS not open');
      handlers.onError?.(new Error("WebSocket disconnected. Cannot send message."));
      const status = connectionStatusRef.current;
      if (status !== 'reconnecting' && status !== 'connecting') {
        updateStatus('error', { message: 'Connection lost. Cannot send message.' });
      }
    }
  }, [handlers, updateStatus]);

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
    updateStatus(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting');
    hasAttemptedConnectionRef.current = true;
    const ws = connectTutorStream(sessionId, jwt);
    wsRef.current = ws;
    ws.onopen = () => {
      if (wsRef.current !== ws) { console.log("[WebSocket] Ignoring open event from stale connection."); ws.close(1000, "Stale connection"); return; }
      console.log(`[WebSocket] Connection OPENED for session: ${sessionId}`);
      reconnectAttemptsRef.current = 0;
      updateStatus('connected');
      handlers.onOpen?.();
      console.log('[WebSocket] Registering send function with store.');
      registerWebSocketSend(sendMessage);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
          pingTimestampRef.current = Date.now();
          if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
          pongTimeoutRef.current = setTimeout(() => {
            console.warn(`[WebSocket] Pong timeout! No pong received within 15 seconds for session ${sessionId}.`);
            if (wsRef.current === ws) {
              updateStatus('error', { message: 'Connection timed out (pong not received).' });
              wsRef.current?.close(1006, "Pong timeout");
            }
          }, 15000);
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
      if (wsRef.current === ws) {
        updateStatus('error', { message: 'WebSocket connection error.' });
        handlers.onError?.(error);
      } else { console.log("[WebSocket] Ignoring error from stale connection attempt."); }
    };
    ws.onclose = (event) => {
      if (wsRef.current !== ws) { console.log(`[WebSocket] Ignoring close event from STALE socket instance for session ${sessionId}.`); return; }
      console.log(`[WebSocket] Connection CLOSED for session ${sessionId}: Code=${event.code}, Reason='${event.reason}'`);
      wsRef.current = null;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current); pingIntervalRef.current = null;
      if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current); pongTimeoutRef.current = null;
      handlers.onClose?.(event);
      if (!isComponentMountedRef.current) { console.log('[WebSocket] Connection closed & component unmounted. Not reconnecting.'); updateStatus('idle'); return; }
      if (event.code === 1008) {
        console.error(`[WebSocket] Authentication failed (Close code 1008). Not reconnecting.`);
        updateStatus('auth_error', { message: 'Authentication failed. Please log in again.', code: 'AUTH_ERROR' });
        toast({ title: 'Authentication Error', description: 'Your session is invalid. Please log in again.', variant: 'destructive', duration: 10000 });
        return;
      } else if (event.code === 1011) {
        console.error(`[WebSocket] Server error (Close code 1011). Not reconnecting.`);
        updateStatus('error', { message: 'The server encountered an internal error.', code: 'SERVER_ERROR_CLOSE' });
        toast({ title: 'Tutor Error', description: 'The tutor encountered an internal issue. Please try again later.', variant: 'destructive', duration: 10000 });
        return;
      } else if (event.code === 1000) {
        console.log('[WebSocket] Normal closure (Code 1000). Not reconnecting.');
        updateStatus('idle');
        return;
      } else {
        updateStatus('reconnecting', { message: `Connection closed unexpectedly (Code: ${event.code}). Reconnecting...`});
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(15000, 1000 * 2 ** reconnectAttemptsRef.current);
        console.log(`[WebSocket] Scheduling reconnect after ${delay}ms... (Attempt ${reconnectAttemptsRef.current})`);
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (isComponentMountedRef.current) { connect(); }
          else { console.log('[WebSocket] Reconnect timer fired, but component unmounted.'); }
        }, delay);
      }
    };
    ws.onmessage = (event) => {
      if (wsRef.current !== ws) { return; }
      let parsedData; try { parsedData = JSON.parse(event.data); } catch (e) { console.error('[WS] message parse error', e); handlers.onError?.(e); updateStatus('error', { message: 'Received invalid message format.' }); return; }

      // --- Handle specific message types ---

      // Ping/Pong
      if (parsedData?.type === 'pong') {
        if (pingTimestampRef.current) {
          setLatency(Date.now() - pingTimestampRef.current);
          pingTimestampRef.current = null;
        }
        // Clear the pong timeout timer since we received a pong
        if (pongTimeoutRef.current) {
          clearTimeout(pongTimeoutRef.current);
          pongTimeoutRef.current = null;
        }
        return; // Handled
      }

      // Ack (if needed)
      if (parsedData?.type === 'ack') {
        console.debug('[WS] Received ack');
        return; // Handled
      }

      // Raw Delta (for streaming later?)
      if (parsedData?.type === 'raw_delta') {
        handlers.onRawResponse?.(parsedData.delta);
        return; // Handled
      }

      // --- Handle InteractionResponseData structure ---
      if (parsedData?.content_type && parsedData.data && parsedData.user_model_state) {
        const { content_type, data, user_model_state } = parsedData;
        console.log(`[WS] Received InteractionResponse: type=${content_type}`);

        // Pass the whole structured response to the handler
        handlers.onInteractionResponse?.(parsedData);

        // Update Zustand store based on content_type
        const currentStoreState = getState();
        const newState: Partial<any> = { userModelState: user_model_state }; // Always update userModelState

        if (content_type === 'error') {
          // Specific handling for BE errors sent via JSON
          const errorData = data as { response_type: 'error', message: string, error_code?: string, details?: any };
          console.error(`[WS] Received backend error: ${errorData.message} (Code: ${errorData.error_code})`);
          newState.error = { message: errorData.message, code: errorData.error_code };
          newState.loadingState = 'idle';
          // Optionally update local status, though store update might be sufficient
          // updateStatus('error', newState.error);
        } else if (content_type === 'message') {
          // Handle successful message response
          newState.currentInteractionContent = data; // Assuming 'data' is MessageResponse
          newState.loadingState = 'idle';
          newState.loadingMessage = '';
          newState.error = null; // Clear previous errors on successful message
        } else {
          // Handle other potential content_types if added later
          console.warn(`[WS] Received unhandled content_type: ${content_type}`);
          newState.loadingState = 'idle'; // Assume idle if unknown type
        }
        setSessionState({ ...currentStoreState, ...newState });
        return; // Handled
      }

      // --- Fallback for older/unstructured message types (Maintain for now?) ---
      // Note: This block might become redundant if BE *always* uses InteractionResponseData
      if (parsedData?.response_type) {
        console.warn("[WS] Received deprecated message structure (using response_type):", parsedData);
        const mainPayload = parsedData;
        handlers.onInteractionResponse?.({ content_type: parsedData.response_type, data: mainPayload, user_model_state: null }); // Adapt to new handler format
        const currentStoreState = getState();
        const newState: Partial<any> = { currentInteractionContent: mainPayload, loadingState: 'idle', loadingMessage: '' };
        if (mainPayload.response_type === 'error') {
          newState.error = { message: mainPayload.message }; // No error code available here
        } else {
          newState.error = null;
        }
        setSessionState({ ...currentStoreState, ...newState });
        return; // Handled
      }


      // --- Catch unhandled messages ---
      console.error('[WS] Received unknown message structure:', parsedData);
      handlers.onUnhandled?.(parsedData);
      updateStatus('error', { message: 'Received unknown message format.' }); // Update status on unknown format

    };
    if (wsRef.current !== ws) {
      console.warn("[WebSocket] wsRef.current was potentially overwritten immediately after creation. Race condition?");
    }
  }, [sessionId, jwt, handlers, registerWebSocketSend, sendMessage, toast, setSessionState, getState, updateStatus]);

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
      if (pongTimeoutRef.current) { clearTimeout(pongTimeoutRef.current); pongTimeoutRef.current = null; }
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

  return { connectionStatus, send: sendMessage, on: onTutorEvent, off: offTutorEvent, latency };
} 