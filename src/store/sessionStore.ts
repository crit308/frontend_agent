import { create } from 'zustand';
import {
  LessonPlan,
  LessonContent,
  Quiz,
  QuizFeedback,
  SessionAnalysis,
  LoadingState,
} from '@/lib/types';

interface SessionState {
  sessionId: string | null;
  vectorStoreId: string | null;
  uploadedFiles: File[];
  lessonPlan: LessonPlan | null;
  lessonContent: LessonContent | null;
  quiz: Quiz | null;
  quizFeedback: QuizFeedback | null;
  sessionAnalysis: SessionAnalysis | null;

  // UI State
  currentStep: 'upload' | 'generating' | 'lesson' | 'quiz' | 'results' | 'analysis';
  loadingState: LoadingState;
  loadingMessage: string;
  error: string | null;

  // Actions
  setSessionId: (sessionId: string) => void;
  setVectorStoreId: (vectorStoreId: string) => void;
  setUploadedFiles: (files: File[]) => void;
  setLessonPlan: (plan: LessonPlan | null) => void;
  setLessonContent: (content: LessonContent | null) => void;
  setQuiz: (quiz: Quiz | null) => void;
  setQuizFeedback: (feedback: QuizFeedback | null) => void;
  setSessionAnalysis: (analysis: SessionAnalysis | null) => void;
  setCurrentStep: (step: SessionState['currentStep']) => void;
  setLoading: (state: LoadingState, message?: string) => void;
  setError: (error: string | null) => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  // Initial State
  sessionId: null,
  vectorStoreId: null,
  uploadedFiles: [],
  lessonPlan: null,
  lessonContent: null,
  quiz: null,
  quizFeedback: null,
  sessionAnalysis: null,
  currentStep: 'upload',
  loadingState: 'idle',
  loadingMessage: '',
  error: null,

  // Actions
  setSessionId: (sessionId) => set({ sessionId, error: null }),
  setVectorStoreId: (vectorStoreId) => set({ vectorStoreId }),
  setUploadedFiles: (files) => set({ uploadedFiles: files }),
  setLessonPlan: (plan) => set({ lessonPlan: plan }),
  setLessonContent: (content) => set({ lessonContent: content }),
  setQuiz: (quiz) => set({ quiz: quiz }),
  setQuizFeedback: (feedback) => set({ quizFeedback: feedback }),
  setSessionAnalysis: (analysis) => set({ sessionAnalysis: analysis }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setLoading: (state, message = '') => set({ loadingState: state, loadingMessage: message, error: state === 'error' ? message : null }),
  setError: (error) => set({ error: error, loadingState: error ? 'error' : 'idle' }),
  resetSession: () => set({
    sessionId: null,
    vectorStoreId: null,
    uploadedFiles: [],
    lessonPlan: null,
    lessonContent: null,
    quiz: null,
    quizFeedback: null,
    sessionAnalysis: null,
    currentStep: 'upload',
    loadingState: 'idle',
    loadingMessage: '',
    error: null,
  }),
})); 