import { create } from 'zustand';
import {
  LessonContent,
  Quiz,
  QuizFeedback,
  LoadingState,
  QuizUserAnswer,
  QuizUserAnswers,
  SessionAnalysis
} from '@/lib/types';

interface SessionState {
  // Core data state
  sessionId: string | null;
  vectorStoreId: string | null;
  lessonContent: LessonContent | null;
  quiz: Quiz | null;
  quizFeedback: QuizFeedback | null;
  userQuizAnswers: { [key: number]: QuizUserAnswer };
  loadingState: LoadingState;
  loadingMessage: string;
  error: string | null;
  sessionAnalysis: SessionAnalysis | null;
  isSubmittingQuiz: boolean;

  // --- SIMPLIFIED Stage-Based Navigation ---
  learningStage: 'lesson' | 'quiz' | 'results' | 'complete';
  currentQuizQuestionIndex: number;
  currentResultItemIndex: number; // 0=summary, 1+=items
  totalQuizQuestions: number;

  // Actions
  setSessionId: (sessionId: string) => void;
  setVectorStoreId: (vectorStoreId: string | null) => void;
  setLessonContent: (content: LessonContent | null) => void;
  setQuiz: (quiz: Quiz | null) => void;
  setQuizFeedback: (feedback: QuizFeedback | null) => void;
  setUserQuizAnswer: (questionIndex: number, answer: QuizUserAnswer) => void;
  setLoading: (state: LoadingState, message?: string) => void;
  setError: (error: string | null) => void;
  setSessionAnalysis: (analysis: SessionAnalysis | null) => void;
  setIsSubmittingQuiz: (isSubmitting: boolean) => void;
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

  // --- SIMPLIFIED Initial Stage State ---
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
      currentQuizQuestionIndex: 0, // Reset quiz progress
      currentResultItemIndex: 0, // Reset results progress
      userQuizAnswers: {}, // Clear previous answers
      quizFeedback: null,  // Clear previous feedback
  }),
  setQuiz: (quiz) => set({
      quiz: quiz,
      totalQuizQuestions: quiz?.questions?.length ?? 0,
      // Don't automatically change stage
  }),
  setQuizFeedback: (feedback) => set({
      quizFeedback: feedback,
      learningStage: 'results', // Jump to results stage
      currentResultItemIndex: 0, // Start at the summary
  }),
  setUserQuizAnswer: (questionIndex, answer) => set((state) => ({
      userQuizAnswers: {
          ...state.userQuizAnswers,
          [questionIndex]: answer,
      },
  })),
  setSessionAnalysis: (analysis) => set({ sessionAnalysis: analysis }),
  setLoading: (state, message = '') => set({ loadingState: state, loadingMessage: message, error: state === 'error' ? message : null }),
  setError: (error) => set({ error: error, loadingState: error ? 'error' : 'idle' }),
  setIsSubmittingQuiz: (isSubmitting) => set({ isSubmittingQuiz: isSubmitting }),
  setLearningStage: (stage) => set({ learningStage: stage }),

  // --- SIMPLIFIED Navigation Logic ---
  goToNextStep: () => set((state) => {
      const { learningStage, currentQuizQuestionIndex, currentResultItemIndex, totalQuizQuestions, quiz, quizFeedback } = state;

      if (learningStage === 'lesson') {
          // Move from lesson to quiz (if exists) or complete
          if (quiz && totalQuizQuestions > 0) {
              return { learningStage: 'quiz', currentQuizQuestionIndex: 0 };
          } else {
              return { learningStage: 'complete' };
          }
      }
      else if (learningStage === 'quiz') {
          // Quiz submission is handled in the component
          if (currentQuizQuestionIndex < totalQuizQuestions - 1) {
              return { currentQuizQuestionIndex: currentQuizQuestionIndex + 1 };
          } else {
              // On last question, stay until submitted (component handles submission trigger)
              console.log("Store: On last quiz question, component should trigger submission.");
              return {};
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
               } else { // Fallback to lesson if no quiz
                   return { learningStage: 'lesson' };
               }
           }
       } else if (learningStage === 'complete') {
            // Go back from complete to last result item or last quiz question or lesson
            if (quizFeedback) {
                 const totalResultItems = (quizFeedback.feedback_items.length) + 1;
                 return { learningStage: 'results', currentResultItemIndex: totalResultItems - 1};
            } else if (quiz && state.totalQuizQuestions > 0) { // Check total questions
                 return { learningStage: 'quiz', currentQuizQuestionIndex: state.totalQuizQuestions - 1 };
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
    // --- Reset Stage State ---
    learningStage: 'lesson',
    currentQuizQuestionIndex: 0,
    currentResultItemIndex: 0,
    totalQuizQuestions: 0,
  }),
}));