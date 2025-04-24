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
  TutorInteractionResponse
} from '@/lib/types';
import type { User } from '@supabase/supabase-js';
import * as api from '@/lib/api';

// Export the interface
export interface SessionState {
  // Core data state
  sessionId: string | null;
  folderId: string | null;
  vectorStoreId: string | null;
  lessonContent: LessonContent | null;
  quiz: Quiz | null;
  quizFeedback: QuizFeedback | null;
  userQuizAnswers: { [key: number]: QuizUserAnswer };
  loadingState: LoadingState;
  loadingMessage: string;
  error: string | null;
  user: User | null;
  sessionAnalysis: SessionAnalysis | null;
  isSubmittingQuiz: boolean;

  // WebSocket state
  webSocketSendFunction: ((payload: any) => void) | null;

  // --- NEW State for Interaction Model ---
  currentInteractionContent: TutorInteractionResponse | null;
  currentContentType: string | null;
  userModelState: UserModelState;
  currentQuizQuestion: QuizQuestion | null;
  isLessonComplete: boolean;
  focusObjective: FocusObjective | null;
  // Mastery tracking from live events
  conceptMastery: Record<string, UserConceptMastery>;

  // Actions
  setSessionId: (sessionId: string) => void;
  setSelectedFolderId: (folderId: string | null) => void;
  setVectorStoreId: (vectorStoreId: string | null) => void;
  setLoading: (state: LoadingState, message?: string) => void;
  setError: (error: string | null) => void;
  setSessionAnalysis: (analysis: SessionAnalysis | null) => void;
  setIsSubmittingQuiz: (isSubmitting: boolean) => void;
  resetSession: () => void;
  setLoadingMessage: (message: string) => void;
  setUser: (user: User | null) => void;
  setFocusObjective: (focus: FocusObjective) => void;
  // Mastery update action
  updateConceptMastery: (concept: string, mastery: UserConceptMastery) => void;

  // WebSocket Actions
  registerWebSocketSend: (sendFn: (payload: any) => void) => void;
  deregisterWebSocketSend: () => void;

  // --- NEW Actions ---
  sendInteraction: (type: 'start' | 'next' | 'answer' | 'question' | 'summary' | 'previous', data?: Record<string, any>) => Promise<void>;
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
  userQuizAnswers: {},
  isSubmittingQuiz: false,
  loadingState: 'idle',
  error: null,
  loadingMessage: '',
  user: null,

  // WebSocket state
  webSocketSendFunction: null,

  // --- NEW Initial State ---
  currentInteractionContent: null,
  currentContentType: null,
  userModelState: { concepts: {}, overall_progress: 0, current_topic: null, session_summary: "Session initializing." },
  currentQuizQuestion: null,
  isLessonComplete: false,
  focusObjective: null,
  conceptMastery: {},

  // Actions
  setSessionId: (sessionId) => set({ sessionId, error: null }),
  setSelectedFolderId: (folderId) => set({ folderId }),
  setVectorStoreId: (vectorStoreId) => set({ vectorStoreId }),
  setLoading: (state, message = '') => set({ loadingState: state, loadingMessage: message, error: state === 'error' ? message : null }),
  setError: (error) => set({ error: error, loadingState: error ? 'error' : 'idle' }),
  setUser: (user) => set({ user }),
  setSessionAnalysis: (analysis) => set({ sessionAnalysis: analysis }),
  setIsSubmittingQuiz: (isSubmitting) => set({ isSubmittingQuiz: isSubmitting }),
  setLoadingMessage: (message) => set({ loadingMessage: message }),
  setFocusObjective: (focus) => set({ focusObjective: focus }),
  // Mastery event reducer
  updateConceptMastery: (concept, mastery) => set(state => ({
    conceptMastery: { ...state.conceptMastery, [concept]: mastery }
  })),

  // WebSocket Action Implementations
  registerWebSocketSend: (sendFn) => set({ webSocketSendFunction: sendFn }),
  deregisterWebSocketSend: () => set({ webSocketSendFunction: null }),

  // --- REVISED Interaction Logic ---
  sendInteraction: async (type, data) => {
      const { sessionId, webSocketSendFunction } = get();
      if (!sessionId) {
          set({ error: "No active session.", loadingState: 'error' });
          return;
      }
      if (!webSocketSendFunction) {
           set({ error: "WebSocket not connected or ready.", loadingState: 'error' });
           console.warn("sendInteraction: WebSocket send function not registered.");
           return;
      }

      set({ loadingState: 'interacting', loadingMessage: 'Sending...', error: null });

      try {
          const payload = { type: type, data: data || {} };
          console.log("Store: Calling registered WebSocket send function with payload:", payload);
          webSocketSendFunction(payload);

      } catch (err: any) {
          const errorMessage = err.message || 'Failed to send interaction via WebSocket.';
          console.error("Store: Error sending interaction via WebSocket:", err);
          set({ error: errorMessage, loadingState: 'error', loadingMessage: '' });
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
    userQuizAnswers: {},
    isSubmittingQuiz: false,
    loadingState: 'idle',
    error: null,
    loadingMessage: '',
    currentInteractionContent: null,
    user: null,
    currentContentType: null,
    userModelState: { concepts: {}, overall_progress: 0, current_topic: null, session_summary: "Session reset." },
    currentQuizQuestion: null,
    isLessonComplete: false,
    focusObjective: null,
    conceptMastery: {},
    webSocketSendFunction: null,
  }),
}));