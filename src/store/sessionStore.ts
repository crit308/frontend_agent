import { create } from 'zustand';
import {
  LessonPlan,
  LessonContent,
  Quiz,
  QuizFeedback,
  SessionAnalysis,
  QuizQuestion,
  LoadingState,
  MiniQuizInfo,
  UserSummaryPromptInfo,
  QuizUserAnswer,
  QuizUserAnswers,
  QuizFeedbackItem,
  SectionContent,
  ExplanationContent,
} from '@/lib/types';

// Define a type for each possible step in the learning flow
type LearningStep =
  | { type: 'lessonIntro' }
  | { type: 'sectionIntro'; sectionIndex: number }
  | { type: 'explanation'; sectionIndex: number; explanationIndex: number }
  | { type: 'miniQuiz'; sectionIndex: number; explanationIndex: number; quizIndex: number }
  | { type: 'userSummary'; sectionIndex: number; explanationIndex: number }
  | { type: 'sectionSummary'; sectionIndex: number }
  | { type: 'lessonConclusion' }
  | { type: 'quizQuestion'; quizQuestionIndex: number }
  | { type: 'resultsSummary' }
  | { type: 'resultItem'; resultItemIndex: number };

// Helper to build the steps array
const buildLearningSteps = (lessonContent: LessonContent | null, quiz: Quiz | null, quizFeedback: QuizFeedback | null): LearningStep[] => {
  const steps: LearningStep[] = [];

  if (lessonContent) {
    steps.push({ type: 'lessonIntro' });

    lessonContent.sections.forEach((section, sectionIndex) => {
      steps.push({ type: 'sectionIntro', sectionIndex });

      section.explanations.forEach((explanation, explanationIndex) => {
        steps.push({ type: 'explanation', sectionIndex, explanationIndex });

        // Add mini-quizzes associated with this explanation
        explanation.mini_quiz?.forEach((_, quizIndex) => {
           steps.push({ type: 'miniQuiz', sectionIndex, explanationIndex, quizIndex });
        });

        // Add user summary prompt after explanation and its mini-quizzes
        steps.push({ type: 'userSummary', sectionIndex, explanationIndex });
      });

      steps.push({ type: 'sectionSummary', sectionIndex });
    });

    steps.push({ type: 'lessonConclusion' });
  }

  if (quiz && quiz.questions.length > 0) {
    quiz.questions.forEach((_, index) => {
      steps.push({ type: 'quizQuestion', quizQuestionIndex: index });
    });
  }

  if (quizFeedback) {
    steps.push({ type: 'resultsSummary' });
    quizFeedback.feedback_items.forEach((_, index) => {
      steps.push({ type: 'resultItem', resultItemIndex: index });
    });
  }

  return steps;
};

interface SessionState {
  // Core state
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

  // Learning steps state
  learningSteps: LearningStep[];
  currentStepIndex: number;

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

  // Learning steps actions
  initializeLearningSteps: (lessonContent: LessonContent | null, quiz: Quiz | null, quizFeedback: QuizFeedback | null) => void;
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
  userQuizAnswers: {},
  isSubmittingQuiz: false,
  loadingState: 'idle',
  loadingMessage: '',
  error: null,
  sessionAnalysis: null,

  // Learning steps state
  learningSteps: [],
  currentStepIndex: 0,

  // Actions
  setSessionId: (sessionId) => set({ sessionId, error: null }),
  setVectorStoreId: (vectorStoreId) => set({ vectorStoreId }),
  setLessonContent: (content) => set((state) => ({
      lessonContent: content,
      // Automatically rebuild steps when content changes
      learningSteps: buildLearningSteps(content, state.quiz, state.quizFeedback),
      currentStepIndex: 0, // Reset index when content changes
  })),
  setQuiz: (quiz) => set((state) => ({
      quiz: quiz,
      // Automatically rebuild steps when quiz changes
      learningSteps: buildLearningSteps(state.lessonContent, quiz, state.quizFeedback),
      // Don't reset index if only quiz is added/changed, unless current step is beyond lesson
      currentStepIndex: state.currentStepIndex,
  })),
  setQuizFeedback: (feedback) => set((state) => ({
      quizFeedback: feedback,
      // Automatically rebuild steps when feedback changes
      learningSteps: buildLearningSteps(state.lessonContent, state.quiz, feedback),
      // Jump to the results summary step when feedback arrives
      currentStepIndex: state.learningSteps.findIndex(step => step.type === 'resultsSummary'),
  })),
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

  initializeLearningSteps: (lessonContent, quiz, quizFeedback) => set({
      learningSteps: buildLearningSteps(lessonContent, quiz, quizFeedback),
      currentStepIndex: 0,
  }),

  goToNextStep: () => set((state) => {
      const nextIndex = state.currentStepIndex + 1;
      if (nextIndex < state.learningSteps.length) {
          return { currentStepIndex: nextIndex };
      }
      // Reached the end - potentially mark as complete or do nothing
      console.log("Reached end of learning steps.");
      return {}; // No change if already at the end
  }),

  goToPreviousStep: () => set((state) => {
      const prevIndex = state.currentStepIndex - 1;
      if (prevIndex >= 0) {
          return { currentStepIndex: prevIndex };
      }
      // At the beginning - do nothing
      console.log("Already at the first learning step.");
      return {}; // No change if already at the start
  }),

  resetSession: () => set({
    sessionId: null,
    vectorStoreId: null,
    lessonContent: null,
    quiz: null,
    quizFeedback: null,
    sessionAnalysis: null,
    userQuizAnswers: {},
    isSubmittingQuiz: false,
    learningSteps: [],
    currentStepIndex: 0,
    loadingState: 'idle',
    loadingMessage: '',
    error: null,
  }),
}));