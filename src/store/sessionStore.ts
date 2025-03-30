import { create } from 'zustand';
import {
  LessonContent,
  Quiz,
  QuizFeedback,
  LoadingState,
  QuizUserAnswer,
  QuizUserAnswers,
  QuizFeedbackItem,
  SectionContent,
  ExplanationContent,
  QuizQuestion,
  SessionAnalysis
} from '@/lib/types';

interface SessionState {
  // Core data state
  sessionId: string | null;
  vectorStoreId: string | null;
  lessonContent: LessonContent | null;
  quiz: Quiz | null;
  quizFeedback: QuizFeedback | null;
  userQuizAnswers: { [key: number]: number };
  loadingState: LoadingState;
  loadingMessage: string;
  error: string | null;
  sessionAnalysis: SessionAnalysis | null;
  isSubmittingQuiz: boolean;

  // --- Stage-Based Navigation ---
  learningStage: 'lesson' | 'quiz' | 'results' | 'complete';
  currentQuizQuestionIndex: number; // Index within the 'quiz' stage
  currentResultItemIndex: number; // Index within the 'results' stage (0 = summary, 1+ = feedback items)
  totalQuizQuestions: number; // Still useful for quiz stage

  // Actions
  setSessionId: (sessionId: string) => void;
  setVectorStoreId: (vectorStoreId: string | null) => void;
  setLessonContent: (content: LessonContent | null) => void;
  setQuiz: (quiz: Quiz | null) => void;
  setQuizFeedback: (feedback: QuizFeedback | null) => void;
  setUserQuizAnswer: (questionIndex: number, answerIndex: number) => void;
  setLoading: (state: LoadingState, message?: string) => void;
  setError: (error: string | null) => void;
  setSessionAnalysis: (analysis: SessionAnalysis | null) => void;
  setIsSubmittingQuiz: (isSubmitting: boolean) => void;

  // --- Modified Actions ---
  setLearningStage: (stage: SessionState['learningStage']) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial State
  sessionId: null,
  vectorStoreId: null,
  lessonContent: null,
  quiz: null,
  quizFeedback: null,
  sessionAnalysis: null,
  userQuizAnswers: {},
  isSubmittingQuiz: false,
  loadingState: 'idle',
  loadingMessage: '',
  error: null,

  // --- Stage-Based State ---
  learningStage: 'lesson', // Start at the lesson view
  currentQuizQuestionIndex: 0,
  currentResultItemIndex: 0,
  totalQuizQuestions: 0,

  // Actions
  setSessionId: (sessionId) => set({ sessionId, error: null }),
  setVectorStoreId: (vectorStoreId) => set({ vectorStoreId }),

  setLessonContent: (content) => set({
      lessonContent: content,
      learningStage: 'lesson', // Reset to lesson stage when new content loads
      currentQuizQuestionIndex: 0,
      currentResultItemIndex: 0,
      userQuizAnswers: {}, // Clear previous answers
      quizFeedback: null,  // Clear previous feedback
  }),
  setQuiz: (quiz) => set({
      quiz: quiz,
      totalQuizQuestions: quiz?.questions?.length ?? 0,
      // Don't automatically change stage here, wait for user navigation
  }),
  setQuizFeedback: (feedback) => set({
      quizFeedback: feedback,
      learningStage: 'results', // Jump to results stage when feedback arrives
      currentResultItemIndex: 0, // Start at the summary
  }),
  setUserQuizAnswer: (questionIndex, answerIndex) => set((state) => ({
      userQuizAnswers: {
          ...state.userQuizAnswers,
          [questionIndex]: answerIndex,
      },
  })),
  setSessionAnalysis: (analysis) => set({ sessionAnalysis: analysis }),
  setLoading: (state, message = '') => set({ loadingState: state, loadingMessage: message, error: state === 'error' ? message : null }),
  setError: (error) => set({ error: error, loadingState: error ? 'error' : 'idle' }),
  setIsSubmittingQuiz: (isSubmitting) => set({ isSubmittingQuiz: isSubmitting }),
  setLearningStage: (stage) => set({ learningStage: stage }),

  // --- Revised Navigation Logic ---
  goToNextStep: () => set((state) => {
      const { learningStage, currentQuizQuestionIndex, currentResultItemIndex, totalQuizQuestions, quiz, quizFeedback } = state;

      if (learningStage === 'lesson') {
          if (quiz && totalQuizQuestions > 0) {
              return { learningStage: 'quiz', currentQuizQuestionIndex: 0 };
          } else {
              return { learningStage: 'complete' }; // Skip quiz if none exists
          }
      }
      else if (learningStage === 'quiz') {
         // Quiz submission is handled in the component
         if (currentQuizQuestionIndex < totalQuizQuestions - 1) {
             return { currentQuizQuestionIndex: currentQuizQuestionIndex + 1 };
         } else {
             // Logic to trigger submission should be in component,
             // successful submission will set feedback and change stage to 'results'
             console.log("On last quiz question, component should trigger submission.");
             return {}; // Stay on last question until submitted
         }
      } else if (learningStage === 'results') {
         const totalResultItems = (quizFeedback?.feedback_items?.length ?? 0) + 1; // +1 for summary
         if (currentResultItemIndex < totalResultItems - 1) {
            return { currentResultItemIndex: currentResultItemIndex + 1 };
         } else {
            return { learningStage: 'complete' }; // Move to complete after last result item
         }
      }
      // Cannot go next from 'complete'
      return {};
  }),

  goToPreviousStep: () => set((state) => {
        const { learningStage, currentQuizQuestionIndex, currentResultItemIndex, quiz, quizFeedback } = state;

        if (learningStage === 'quiz') {
            if (currentQuizQuestionIndex > 0) {
                return { currentQuizQuestionIndex: currentQuizQuestionIndex - 1 };
            } else {
                // Go back from first quiz question to lesson
                return { learningStage: 'lesson' };
            }
        } else if (learningStage === 'results') {
            if (currentResultItemIndex > 0) {
                return { currentResultItemIndex: currentResultItemIndex - 1 };
            } else {
                // Go back from results summary to last quiz question
                 if (quiz && state.totalQuizQuestions > 0) {
                   return { learningStage: 'quiz', currentQuizQuestionIndex: state.totalQuizQuestions - 1 };
                 } else { // Fallback to lesson if no quiz somehow
                     return { learningStage: 'lesson' };
                 }
            }
        } else if (learningStage === 'complete') {
             // Go back from complete to last result item or last quiz question or lesson
             if (quizFeedback) {
                 const totalResultItems = (quizFeedback.feedback_items.length) + 1;
                 return { learningStage: 'results', currentResultItemIndex: totalResultItems - 1};
             } else if (quiz) {
                  return { learningStage: 'quiz', currentQuizQuestionIndex: state.totalQuizQuestions -1 };
             } else {
                  return { learningStage: 'lesson' };
             }
        }
        // Cannot go back from 'lesson'
        return {};
    }),

  resetSession: () => set({
    // ... reset core data ...
    sessionId: null,
    vectorStoreId: null,
    lessonContent: null,
    quiz: null,
    quizFeedback: null,
    sessionAnalysis: null,
    userQuizAnswers: {},
    isSubmittingQuiz: false,
    loadingState: 'idle',
    loadingMessage: '',
    error: null,
    // --- Reset Stage-Based State ---
    learningStage: 'lesson',
    currentQuizQuestionIndex: 0,
    currentResultItemIndex: 0,
    totalQuizQuestions: 0,
  }),
}));