import React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { connectTutorStream, StreamEvent, onTutorEvent, offTutorEvent } from './wsTutor';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction, type ToastActionElement } from '@/components/ui/toast';
import { useSessionStore, type SessionState, type StructuredError, type LoadingState, type ChatMessage } from '@/store/sessionStore';
import {
  InteractionResponseData,
  QuestionResponse,
  ErrorResponse,
  ExplanationResponse,
  FeedbackResponse,
  type TutorInteractionResponse,
  MessageResponse,
  WhiteboardAction,
  CanvasObjectSpec
} from '@/lib/types';
import { useWhiteboard } from '@/contexts/WhiteboardProvider';

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
  onInteractionResponse?: (response: { content_type: string; data: any; user_model_state: any; whiteboard_actions?: WhiteboardAction[] }) => void;
  onWhiteboardStateReceived?: (actions: WhiteboardAction[]) => void;
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
  const isMountedEffectRef = useRef(false); // Tracks if the *current* instance's effect is active
  const { dispatchWhiteboardAction } = useWhiteboard();

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
      if (wsRef.current !== ws || !isComponentMountedRef.current) { console.log("[WebSocket] Ignoring open event from stale connection or unmounted component."); ws.close(1000, "Stale connection/Unmounted"); return; }
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
      if (wsRef.current !== ws || !isComponentMountedRef.current) { console.log("[WebSocket] Ignoring error from stale connection or unmounted component."); return; }
      updateStatus('error', { message: 'WebSocket connection error.' });
      handlers.onError?.(error);
    };
    ws.onclose = (event) => {
      if (wsRef.current !== ws) { console.log(`[WebSocket] Ignoring close event from STALE socket instance for session ${sessionId}.`); return; }
      console.log(`[WebSocket] Connection CLOSED for session ${sessionId}: Code=${event.code}, Reason='${event.reason}'`);
      wsRef.current = null;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current); pingIntervalRef.current = null;
      if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current); pongTimeoutRef.current = null;
      if (!isComponentMountedRef.current) {
        console.log('[WebSocket] Connection closed, but component already unmounted. Final state update skipped.');
        return;
      }
      handlers.onClose?.(event);
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
      if (wsRef.current !== ws || !isComponentMountedRef.current) { console.log("[WebSocket] Ignoring message from stale connection or unmounted component."); return; }
      console.log("[WS Received Raw]:", event.data); // Log raw message
      let parsedData; try { parsedData = JSON.parse(event.data); } catch (e) { console.error('[WS] message parse error', e); handlers.onError?.(e); updateStatus('error', { message: 'Received invalid message format.' }); return; }
      console.log("[WS Parsed Data]:", parsedData); // Log parsed message

      // --- Handle specific message types ---

      // +++ Handle Whiteboard State Hydration First +++
      if (parsedData?.type === 'whiteboard_state' && parsedData?.data?.actions) {
          if (Array.isArray(parsedData.data.actions)) {
              console.log(`[WS] Received whiteboard_state with ${parsedData.data.actions.length} actions.`);
              // Pass actions to the dedicated handler if provided
              handlers.onWhiteboardStateReceived?.(parsedData.data.actions as WhiteboardAction[]);
          } else {
              console.warn('[WS] Received whiteboard_state but data.actions is not an array:', parsedData.data.actions);
          }
          return; // Handled
      }
      // --- End Whiteboard State Handling ---

      console.log("[WS] Raw parsed data (after whiteboard check):", parsedData); // Log raw structure

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
      // Check if it matches the expected wrapper structure
      if (
        parsedData && typeof parsedData === 'object' &&
        'content_type' in parsedData &&
        'data' in parsedData &&
        'user_model_state' in parsedData
      ) {
        // --- Runtime validation for structure ---
        const hasValidContentType = typeof parsedData.content_type === 'string';
        const hasValidData = typeof parsedData.data === 'object' && parsedData.data !== null;
        const hasValidUserModelState = typeof parsedData.user_model_state === 'object' && parsedData.user_model_state !== null;
        if (!hasValidContentType || !hasValidData || !hasValidUserModelState) {
          console.warn('[WS Validation] Invalid InteractionResponseData structure:', {
            hasValidContentType,
            hasValidData,
            hasValidUserModelState,
            parsedData
          });
          // Optionally, call error handler or show toast
          handlers.onError?.(new Error('Invalid InteractionResponseData structure received.'));
          return;
        }
        const interactionResponse = parsedData as InteractionResponseData; // Type assertion after validation
        console.log(`[WS] Received InteractionResponse: type=${interactionResponse.content_type}`);

        // --- Whiteboard Action Dispatch ---
        if (interactionResponse.whiteboard_actions && Array.isArray(interactionResponse.whiteboard_actions)) {
          try {
            dispatchWhiteboardAction(interactionResponse.whiteboard_actions);
            console.log('[WS] Dispatched whiteboard actions:', interactionResponse.whiteboard_actions);
          } catch (err) {
            console.error('[WS] Error dispatching whiteboard actions:', err);
          }
        }

        // Extract the relevant parts
        const contentType = interactionResponse.content_type;
        const dataPayload = interactionResponse.data; // This is ExplanationResponse, QuestionResponse etc.
        const userModelState = interactionResponse.user_model_state;

        // Pass the whole structured response to the handler if provided (optional)
        handlers.onInteractionResponse?.(interactionResponse);

        // Update Zustand store using functional update
        setSessionState((prevState) => {
            let newError: StructuredError | null = null;
            let newLoadingState: LoadingState = 'idle'; // Always set to idle after response
            let newMessages = prevState.messages; // Start with existing messages

            // Initialize update object
            const update: Partial<SessionState> = {
                userModelState, // Always update user model state
                loadingState: newLoadingState,
                loadingMessage: '',
                error: newError, // Reset error on successful interaction
                // Initialize with the NEW dataPayload by default
                currentInteractionContent: dataPayload as TutorInteractionResponse | null,
                sessionEndedConfirmed: prevState.sessionEndedConfirmed, // Preserve existing value
            };

            // --- Handle different content types ---
            switch (contentType) {
                case 'explanation':
                case 'question':
                case 'feedback':
                case 'message':
                    // The default update already sets currentInteractionContent correctly
                    console.log(`[WS Store Update] Setting currentInteractionContent for type: ${contentType}`);
                     // Add the NEW interaction content to the messages array
                    try {
                        const interactionToAdd = dataPayload as TutorInteractionResponse;

                        // --- EXTRACT STRING CONTENT --- START
                        let messageContentString = "Assistant message received."; // Fallback
                        if ('text' in interactionToAdd && typeof interactionToAdd.text === 'string') {
                            messageContentString = interactionToAdd.text;
                        } else if ('question' in interactionToAdd && typeof interactionToAdd.question?.question === 'string') {
                            // Basic question text for chat history
                            messageContentString = `Question: ${interactionToAdd.question.question}`;
                            if (interactionToAdd.question.options && Array.isArray(interactionToAdd.question.options)) {
                                const options = interactionToAdd.question.options.map((opt, i) => `\n${i + 1}. ${opt}`).join('');
                                messageContentString += options;
                            }
                        } else if ('feedback' in interactionToAdd && interactionToAdd.feedback) {
                            // Basic feedback text for chat history
                            const fb = interactionToAdd.feedback;
                            const correctness = fb.is_correct ? 'Correct' : 'Incorrect';
                            messageContentString = `Feedback (${correctness}): Regarding "${fb.question_text}"`;
                            if (fb.explanation) {
                                messageContentString += `\nExplanation: ${fb.explanation}`;
                            }
                        }
                        // Add more cases here if other response types need specific string formatting
                        // --- EXTRACT STRING CONTENT --- END

                        // Simple timestamp ID - consider using a UUID library later if needed
                        const messageToAdd: ChatMessage = {
                            id: Date.now().toString() + Math.random().toString(36).substring(2), // Add randomness to avoid collisions
                            role: 'assistant',
                            content: messageContentString, // Use extracted string content
                            interaction: interactionToAdd, // Store the original interaction object
                            ...(interactionToAdd && 'whiteboard_actions' in interactionToAdd && Array.isArray((interactionToAdd as any).whiteboard_actions)
                                ? { whiteboard_actions: (interactionToAdd as any).whiteboard_actions }
                                : {})
                        };
                        newMessages = [...prevState.messages, messageToAdd];
                        update.messages = newMessages; // Include updated messages in the update object
                        console.log(`[WS Store Update] Added assistant message to history. New count: ${newMessages.length}`);
                    } catch (error) {
                        console.error("[WS Store Update] Error creating or adding assistant message:", error, dataPayload);
                        // Decide if you want to set an error state here or just log
                    }
                    break;

                case 'error':
                    const errorPayload = dataPayload as ErrorResponse;
                    console.error('[WS Store Update] Received error:', errorPayload.message, errorPayload.details);
                    newError = { message: errorPayload.message, code: errorPayload.error_code };
                    update.error = newError;
                    update.loadingState = 'error'; // Set to error on error response
                    update.currentInteractionContent = errorPayload; // Set error content

                    // Add error message to the chat history
                    const errorMessageToAdd: ChatMessage = {
                        id: Date.now().toString() + Math.random().toString(36).substring(2),
                        role: 'assistant',
                        content: `Error: ${errorPayload.message}`,
                        interaction: errorPayload // Store the error object
                    };
                    newMessages = [...prevState.messages, errorMessageToAdd];
                    // No need to set update.messages here, it's handled below

                    toast({
                        title: `Tutor Error${errorPayload.error_code ? ` (${errorPayload.error_code})` : ''}`,
                        description: errorPayload.message || 'An unknown error occurred.',
                        variant: 'destructive',
                        duration: 10000,
                        action: getAnalysisAction(),
                    });
                    break;

                case 'session_ended':
                    console.log("[WS Store Update] Received session_ended confirmation.");
                    update.sessionEndedConfirmed = true;
                    update.loadingState = 'idle';
                    update.currentInteractionContent = null; // Clear content on session end

                    // Add Session Ended system message to history
                    const endMessageToAdd: ChatMessage = {
                        id: Date.now().toString() + Math.random().toString(36).substring(2),
                        role: 'assistant', // Or maybe a 'system' role if you add it
                        content: 'Session ended.',
                        interaction: null // No specific interaction object for this
                    };
                    newMessages = [...prevState.messages, endMessageToAdd];
                    // No need to set update.messages here, it's handled below

                    break;

                default:
                    console.warn(`[WS Store Update] Unhandled content_type: ${contentType}`, parsedData);
                    update.currentInteractionContent = null; // Clear for unhandled types
            }

            // Update messages only if they changed
            if (newMessages !== prevState.messages) {
                 update.messages = newMessages;
            }


            console.log("[WS Store Update] Final state update object:", update);
            // Apply the updates to the previous state
            return { ...prevState, ...update };
        });

        return; // Handled
      } else {
         console.warn("[WS] Received data does not match InteractionResponseData structure:", parsedData);
      }

      // --- Handle other event types (if any) ---
      // Example: Agent updated event
      if (parsedData?.type === 'agent_updated') {
        handlers.onAgentUpdated?.(parsedData.event);
        return; // Handled
      }
      // Example: Run item event
      if (parsedData?.type === 'run_item') {
        handlers.onRunItem?.(parsedData.item);
        return; // Handled
      }

      // Default/Fallback Handling
      handlers.onUnhandled?.(parsedData);
      console.warn("[WS] Unhandled message type or structure:", parsedData);
    };
    if (wsRef.current !== ws) {
      console.warn("[WebSocket] wsRef.current was potentially overwritten immediately after creation. Race condition?");
    }
  }, [sessionId, jwt, handlers, registerWebSocketSend, sendMessage, toast, setSessionState, getState, updateStatus, dispatchWhiteboardAction]);

  // --- Main Effect for Connection Management ---
  useEffect(() => {
    isComponentMountedRef.current = true; // Component is mounting or re-mounting

    // Prevent double invocation issues in StrictMode/Fast Refresh
    if (isMountedEffectRef.current) {
       console.log("[WebSocket] Mount effect skipped: Already mounted/running from a previous effect run.");
       // If we skip, it means the previous effect's instance is likely the one we want to keep.
       // We might need to ensure the cleanup from THIS skipped run doesn't interfere,
       // but the main goal is to let the *first* effect's instance establish itself.
       return;
    }
    isMountedEffectRef.current = true;
    console.log("[WebSocket] Mount effect running. Attempting initial connect.");

    connect(); // Attempt connection

    // Store the WebSocket instance initiated by THIS effect run
    // Note: connect() sets wsRef.current asynchronously within itself.
    // We capture the ref value *after* connect starts, but the instance might change later.
    // The check inside cleanup needs to be robust.


    return () => {
      console.log(`[WebSocket] Cleanup effect running for session: ${sessionId}`);
      isMountedEffectRef.current = false; // Mark this specific effect instance as "unmounted"

      // Store the WebSocket instance that was active *when this cleanup function was created*.
      const wsInstanceAtCleanupTime = wsRef.current;

      // Add a small delay ONLY IN DEV to see if a remount happens quickly
      // This helps prevent the first mount's cleanup from destroying the second mount's connection
      const timeoutId = setTimeout(() => {
          console.log(`[WebSocket] Delayed cleanup executing. isMountedEffectRef.current (flag from other potential effect): ${isMountedEffectRef.current}`);

          // Only perform cleanup if another mount effect hasn't immediately set the flag back to true
          // AND if the WebSocket instance associated with this cleanup closure still exists.
          if (!isMountedEffectRef.current && wsInstanceAtCleanupTime) {
               console.log(`[WebSocket] Performing cleanup for WS instance associated with this effect run.`);

               // Clear timers associated with this hook instance
               if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
               if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
               if (pongTimeoutRef.current) { clearTimeout(pongTimeoutRef.current); pongTimeoutRef.current = null; }


               // Nullify callbacks on the specific instance we captured to prevent memory leaks/stale closures
               wsInstanceAtCleanupTime.onclose = null;
               wsInstanceAtCleanupTime.onerror = null;
               wsInstanceAtCleanupTime.onmessage = null;
               wsInstanceAtCleanupTime.onopen = null;

               try {
                  // Check the state of the instance we are cleaning up
                  if (wsInstanceAtCleanupTime.readyState === WebSocket.OPEN || wsInstanceAtCleanupTime.readyState === WebSocket.CONNECTING) {
                      wsInstanceAtCleanupTime.close(1000, "Component unmounting or effect cleanup");
                      console.log("[WebSocket] WS close called in delayed cleanup.");
                  } else {
                      console.log(`[WebSocket] WS not open/connecting (state: ${wsInstanceAtCleanupTime.readyState}), cleanup skipping close call.`);
                  }
               } catch (e) { console.warn("[WebSocket] Error during delayed cleanup close:", e)}

               // Only clear the main wsRef if the instance we just closed IS the currently active one.
               // This prevents accidentally nulling out the ref if a quick remount already established a new connection.
               if(wsRef.current === wsInstanceAtCleanupTime) {
                    wsRef.current = null;
                    console.log('[WebSocket] Cleared main wsRef.');
               } else {
                    console.log('[WebSocket] Main wsRef points to a different instance; not clearing it.');
               }
               console.log('[WebSocket] Deregistering send function.');
               deregisterWebSocketSend(); // Deregister from store
          } else {
              console.log(`[WebSocket] Delayed cleanup skipped: Component likely remounted quickly or WS instance changed/already cleaned up.`);
          }
          // Mark the overall component as potentially unmounted after cleanup logic runs
          // Note: This assumes the *final* cleanup corresponds to the actual component unmount.
          // This might be slightly delayed.
          if (!isMountedEffectRef.current) { // Check again in case remount happened during timeout
             isComponentMountedRef.current = false;
             console.log('[WebSocket] Component marked as unmounted after delayed cleanup.')
          }

      }, 150); // Small delay (e.g., 150ms) - adjust as needed

      // This inner return function cleans up the setTimeout itself if the component
      // truly unmounts (or the effect re-runs) *before* the 150ms delay finishes.
      console.log('[WebSocket] Cleanup effect complete, clearing timeout if it exists.');
      clearTimeout(timeoutId);
    };
  }, [sessionId, jwt, connect, deregisterWebSocketSend, registerWebSocketSend, sendMessage]); // Added register/sendMessage dependencies

  // --- Cleanup on unmount (redundant with useEffect cleanup but belts and suspenders) ---
  useEffect(() => {
    // This effect ONLY runs once on mount and returns a cleanup function for final unmount
    return () => {
        console.log("[WebSocket] FINAL unmount effect triggered.");
        isComponentMountedRef.current = false; // Mark definitively as unmounted
        isMountedEffectRef.current = false; // Ensure effect flag is also false

        // Clear any outstanding timers
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);

        const currentWs = wsRef.current;
        if (currentWs) {
            console.log("[WebSocket] Closing socket in FINAL unmount cleanup.");
            // Remove listeners to prevent errors after unmount
            currentWs.onclose = null;
            currentWs.onerror = null;
            currentWs.onmessage = null;
            currentWs.onopen = null;
            try { if (currentWs.readyState === WebSocket.OPEN) currentWs.close(1000, "Component unmounted definitively"); } catch (e) { console.warn("[WebSocket] Error closing socket in final unmount:", e); }
            wsRef.current = null;
        }
        console.log('[WebSocket] Deregistering send function on FINAL unmount.');
        deregisterWebSocketSend(); // Ensure deregistration happens
    };
  }, [deregisterWebSocketSend]); // Only needs store action dependency

  return { connectionStatus, latency, sendMessage };
} 