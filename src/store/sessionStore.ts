import { create } from 'zustand';
import {
  LessonContent,
  Quiz,
  QuizFeedback,
  LoadingState,
  QuizUserAnswer,
  QuizUserAnswers,
  SessionAnalysis,
  QuizQuestion,
  QuizFeedbackItem,
  UserModelState,
  UserConceptMastery,
  UserInteractionOutcome,
  FocusObjective,
  TutorInteractionResponse,
  ErrorResponse,
  WhiteboardAction
} from '@/lib/types';
import type { User } from '@supabase/supabase-js';
import * as api from '@/lib/api';

// Define connection status type (matches useTutorStream)
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'auth_error';

// Define structured error type
export interface StructuredError {
  message: string;
  code?: string; // e.g., SESSION_LOAD_FAILED, AUTH_ERROR
}

// Define a unified message type for the chat history
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant'; // Use role instead of sender
  content: string; // Always the string representation for basic display
  interaction?: TutorInteractionResponse | ErrorResponse | null; // Store the original interaction object for assistant messages
  isLoading?: boolean; // Optional loading state
  whiteboard_actions?: WhiteboardAction[]; // Optional whiteboard actions at the top level
}

// Export the LoadingState type as well
export type { LoadingState };

// Export the interface
export interface SessionState {
  // Core data state
  sessionId: string | null;
  folderId: string | null;
  vectorStoreId: string | null;
  lessonContent: LessonContent | null;
  quiz: Quiz | null;
  quizFeedback: QuizFeedback | null;
  quizUserAnswers: { [key: number]: QuizUserAnswer };
  loadingState: LoadingState;
  loadingMessage: string;
  error: StructuredError | null;
  user: User | null;
  sessionAnalysis: SessionAnalysis | null;
  isSubmittingQuiz: boolean;

  // WebSocket state
  webSocketSendFunction: ((payload: any) => void) | null;
  connectionStatus: ConnectionStatus;

  // --- NEW State for Interaction Model ---
  currentInteractionContent: TutorInteractionResponse | null;
  userModelState: UserModelState;
  currentQuizQuestion: QuizQuestion | null;
  isLessonComplete: boolean;
  focusObjective: FocusObjective | null;
  sessionEndedConfirmed: boolean;

  // NEW: Array to hold chat history
  messages: ChatMessage[];

  // Actions
  setSessionId: (sessionId: string) => void;
  setSelectedFolderId: (folderId: string | null) => void;
  setVectorStoreId: (vectorStoreId: string | null) => void;
  setLoading: (state: LoadingState, message?: string) => void;
  setError: (error: StructuredError | null) => void;
  setSessionAnalysis: (analysis: SessionAnalysis | null) => void;
  setIsSubmittingQuiz: (isSubmitting: boolean) => void;
  resetSession: () => void;
  setLoadingMessage: (message: string) => void;
  setUser: (user: User | null) => void;
  setFocusObjective: (focus: FocusObjective) => void;

  // WebSocket Actions
  registerWebSocketSend: (sendFn: (payload: any) => void) => void;
  deregisterWebSocketSend: () => void;

  // --- NEW Actions ---
  sendInteraction: (type: 'start' | 'next' | 'answer' | 'user_message' | 'summary' | 'previous' | 'end_session', data?: Record<string, any>) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial State
  sessionId: null,
  folderId: null,
  vectorStoreId: null,
  lessonContent: null,
  quiz: null,
  quizFeedback: null,
  sessionAnalysis: null,
  quizUserAnswers: {},
  isSubmittingQuiz: false,
  loadingState: 'idle',
  error: null,
  loadingMessage: '',
  user: null,

  // WebSocket state
  webSocketSendFunction: null,
  connectionStatus: 'idle',

  // --- NEW Initial State ---
  currentInteractionContent: null,
  userModelState: { concepts: {}, overall_progress: 0, current_topic: null, session_summary: "Session initializing." },
  currentQuizQuestion: null,
  isLessonComplete: false,
  focusObjective: null,
  sessionEndedConfirmed: false,

  // NEW: Initialize messages array
  messages: [],

  // Actions
  setSessionId: (sessionId) => set({ sessionId, error: null }),
  setSelectedFolderId: (folderId) => set({ folderId }),
  setVectorStoreId: (vectorStoreId) => set({ vectorStoreId }),
  setLoading: (state, message = '') => set({ loadingState: state, loadingMessage: message, error: state === 'error' ? { message: message || 'An error occurred' } : null }),
  setError: (error) => set({ error: error, loadingState: error ? 'error' : 'idle' }),
  setUser: (user) => set({ user }),
  setSessionAnalysis: (analysis) => set({ sessionAnalysis: analysis }),
  setIsSubmittingQuiz: (isSubmitting) => set({ isSubmittingQuiz: isSubmitting }),
  setLoadingMessage: (message) => set({ loadingMessage: message }),
  setFocusObjective: (focus) => set({ focusObjective: focus }),

  // WebSocket Action Implementations
  registerWebSocketSend: (sendFn) => set({ webSocketSendFunction: sendFn }),
  deregisterWebSocketSend: () => set({ webSocketSendFunction: null }),

  // --- REVISED Interaction Logic ---
  sendInteraction: async (type, data) => {
      const { sessionId, webSocketSendFunction } = get();
      if (!sessionId) {
          set({ error: { message: "No active session." }, loadingState: 'error' });
          return;
      }
      if (!webSocketSendFunction) {
           set({ error: { message: "WebSocket not connected or ready." }, loadingState: 'error' });
           console.warn("sendInteraction: WebSocket send function not registered.");
           return;
      }

      set({ loadingState: 'interacting', loadingMessage: 'Sending...', error: null });

      try {
          // Construct the payload based on type
          let payload;
          let userMessage: ChatMessage | null = null;
          if (type === 'user_message') {
              // Ensure data exists and has a 'text' property
              const text = data?.text;
              if (typeof text !== 'string') {
                  console.error("Store: 'user_message' type requires a 'text' field in data.");
                  set({ error: { message: "Invalid message format." }, loadingState: 'error', loadingMessage: '' });
                  return;
              }
              payload = { type: type, data: { text: text } };
              // Create user message object to add to state
              userMessage = {
                id: Date.now().toString(), // Simple ID for now
                role: 'user',
                content: text,
              };
          } else {
              payload = { type: type, data: data || {} };
          }
          
          console.log("Store: Calling registered WebSocket send function with payload:", payload);
          webSocketSendFunction(payload);

          // Add user message to the messages array immediately
          if (userMessage) {
              set(state => ({ messages: [...state.messages, userMessage!] }));
          }

      } catch (err: any) {
          const errorMessage = err.message || 'Failed to send interaction via WebSocket.';
          console.error("Store: Error sending interaction via WebSocket:", err);
          set({ error: { message: errorMessage }, loadingState: 'error', loadingMessage: '' });
      }
  },

  resetSession: () => set({
    sessionId: null,
    folderId: null,
    vectorStoreId: null,
    lessonContent: null,
    quiz: null,
    quizFeedback: null,
    sessionAnalysis: null,
    quizUserAnswers: {},
    isSubmittingQuiz: false,
    loadingState: 'idle',
    error: null,
    loadingMessage: '',
    currentInteractionContent: null,
    messages: [],
    user: null,
    userModelState: { concepts: {}, overall_progress: 0, current_topic: null, session_summary: "Session reset." },
    currentQuizQuestion: null,
    isLessonComplete: false,
    focusObjective: null,
    webSocketSendFunction: null,
    connectionStatus: 'idle',
    sessionEndedConfirmed: false,
  }),
}));