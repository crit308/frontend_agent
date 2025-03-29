import { create } from 'zustand';
import {
  LessonPlan,
  LessonContent,
  Quiz,
  QuizFeedback,
  SessionAnalysis,
  QuizQuestion, // Needed for mini-quiz typing
  LoadingState,
} from '@/lib/types';

// Helper function to count total items in a lesson (can be adjusted based on exact flow)
const countLessonItems = (lessonContent: LessonContent | null): number => {
    if (!lessonContent) return 0;
    let count = 1; // Start with lesson intro
    lessonContent.sections.forEach(section => {
        count++; // Section Intro
        count += section.explanations.length; // Each explanation
        section.explanations.forEach(exp => {
            count += exp.mini_quiz?.length ?? 0; // Each mini-quiz
            count++; // Each user summary prompt
        });
        count++; // Section Summary
    });
    count++; // Lesson Conclusion
    return count;
};

// Define interfaces matching backend additions (or import if possible)
interface MiniQuizInfo {
  related_section_title: string;
  related_topic: string;
  quiz_question: QuizQuestion;
}

interface UserSummaryPromptInfo {
  section_title: string;
  topic: string;
}

interface SessionState {
  sessionId: string | null;
  vectorStoreId: string | null;
  uploadedFiles: File[];
  lessonPlan: LessonPlan | null;
  lessonContent: LessonContent | null;
  quiz: Quiz | null;
  // Separate lists for practice phase items
  miniQuizzes: MiniQuizInfo[] | null; // Store the collected mini quizzes
  userSummaries: UserSummaryPromptInfo[] | null; // Store the collected summary prompts
  quizFeedback: QuizFeedback | null;
  sessionAnalysis: SessionAnalysis | null;

  // UI State
  userQuizAnswers: { [key: number]: number }; // Store answers: { questionIndex: selectedOptionIndex }
  isSubmittingQuiz: boolean; // Track quiz submission API call
  // Updated Learning Stages
  learningStage: 'lesson' | 'practice' | 'quiz' | 'results' | 'complete';
  // Removed section/item indices, navigation is between stages now
  currentQuizQuestionIndex: number;
  currentResultItemIndex: number; // For paginating results feedback
  totalQuizQuestions: number;
  loadingState: LoadingState;
  loadingMessage: string;
  error: string | null;

  // Actions
  setSessionId: (sessionId: string) => void;
  setVectorStoreId: (vectorStoreId: string | null) => void;
  setUploadedFiles: (files: File[]) => void;
  setLessonPlan: (plan: LessonPlan | null) => void;
  setLessonContent: (content: LessonContent | null) => void;
  // setMiniQuizzes: (quizzes: MiniQuizInfo[] | null) => void; // Setters for new state
  // setUserSummaries: (summaries: UserSummaryPromptInfo[] | null) => void;
  setQuiz: (quiz: Quiz | null) => void;
  setQuizFeedback: (feedback: QuizFeedback | null) => void;
  setUserQuizAnswer: (questionIndex: number, answerIndex: number) => void;
  setSessionAnalysis: (analysis: SessionAnalysis | null) => void;
  setLoading: (state: LoadingState, message?: string) => void;
  setError: (error: string | null) => void;
  setLearningStage: (stage: SessionState['learningStage']) => void;
  initializeStepIndices: (lessonContent: LessonContent | null, quiz: Quiz | null) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  // Initial State
  sessionId: null,
  vectorStoreId: null,
  uploadedFiles: [],
  lessonPlan: null,
  lessonContent: null,
  miniQuizzes: null,
  userSummaries: null,
  userQuizAnswers: {},
  isSubmittingQuiz: false,
  learningStage: 'lesson',
  currentQuizQuestionIndex: 0,
  currentResultItemIndex: 0,
  totalQuizQuestions: 0,
  quiz: null,
  quizFeedback: null,
  sessionAnalysis: null,
  loadingState: 'idle',
  loadingMessage: '',
  error: null,

  // Actions
  setSessionId: (sessionId) => set({ sessionId, error: null }),
  setVectorStoreId: (vectorStoreId) => set({ vectorStoreId }),
  setUploadedFiles: (files) => set({ uploadedFiles: files }),
  setLessonPlan: (plan) => set({ lessonPlan: plan }),
  setLessonContent: (content) => set((state) => {
    const miniQuizzes = content?.mini_quizzes ?? null;
    const userSummaries = content?.user_summary_prompts ?? null;
    return { lessonContent: content, miniQuizzes, userSummaries };
  }),
  // setMiniQuizzes: (quizzes) => set({ miniQuizzes: quizzes }), // Direct setters if needed elsewhere
  // setUserSummaries: (summaries) => set({ userSummaries: summaries }),
  setQuiz: (quiz) => set({ quiz: quiz }),
  setQuizFeedback: (feedback) => set({ quizFeedback: feedback }),
  setUserQuizAnswer: (questionIndex, answerIndex) => set((state) => ({
      userQuizAnswers: {
          ...state.userQuizAnswers,
          [questionIndex]: answerIndex,
      },
  })),
  setSessionAnalysis: (analysis) => set({ sessionAnalysis: analysis }),
  setLoading: (state, message = '') => set({ loadingState: state, loadingMessage: message, error: state === 'error' ? message : null }),
  setError: (error) => set({ error: error, loadingState: error ? 'error' : 'idle' }),
  setLearningStage: (stage) => set({ learningStage: stage }),
  
  initializeStepIndices: (lessonContent, quiz) => set((state) => {
      const numLessonItems = countLessonItems(lessonContent);
      const numQuizQuestions = quiz?.questions?.length ?? 0;
      return {
        learningStage: 'lesson',
        currentQuizQuestionIndex: 0,
        currentResultItemIndex: 0,
        totalQuizQuestions: numQuizQuestions,
      };
  }),
  
  // --- Navigation Logic (Refined for Phase 4) ---
  goToNextStep: () => set((state) => {
      const { learningStage, currentQuizQuestionIndex, currentResultItemIndex, totalQuizQuestions, quizFeedback, quiz, miniQuizzes, userSummaries } = state;
      const hasPracticeItems = (miniQuizzes && miniQuizzes.length > 0) || (userSummaries && userSummaries.length > 0);

      if (learningStage === 'lesson') {
          // Move from lesson to practice (if items exist) or quiz
          if (hasPracticeItems) {
              return { learningStage: 'practice' };
          } else if (quiz && totalQuizQuestions > 0) {
             return { learningStage: 'quiz', currentQuizQuestionIndex: 0 };
          } else {
             return { learningStage: 'complete' };
          }
      }
      else if (learningStage === 'practice') {
          // Move from practice to quiz
          if (quiz && totalQuizQuestions > 0) {
             return { learningStage: 'quiz', currentQuizQuestionIndex: 0 };
          } else {
             return { learningStage: 'complete' };
          }
      }
      else if (learningStage === 'quiz') {
         // Logic for quiz submission is handled in the component
         if (currentQuizQuestionIndex < totalQuizQuestions - 1) {
             return { currentQuizQuestionIndex: currentQuizQuestionIndex + 1 };
         } else {
             // On last question, component triggers submission. State change handled by submission success.
             console.log("On last quiz question, submission should be triggered by component.");
             return {};
         }
      } else if (learningStage === 'results') {
         // Navigate through result items
         const totalResultItems = (quizFeedback?.feedback_items?.length ?? 0) + 1; // +1 for summary
         if (currentResultItemIndex < totalResultItems - 1) {
            return { currentResultItemIndex: currentResultItemIndex + 1 };
         } else {
            console.log("End of results reached.");
            return { learningStage: 'complete' };
         }
      }
      return {}; // Default no change
  }),

  goToPreviousStep: () => set((state) => {
        const { learningStage, currentQuizQuestionIndex, currentResultItemIndex, quiz, miniQuizzes, userSummaries } = state;
        const hasPracticeItems = (miniQuizzes && miniQuizzes.length > 0) || (userSummaries && userSummaries.length > 0);

       if (learningStage === 'practice') {
            // Go back from practice to lesson
           return { learningStage: 'lesson' };
        } else if (learningStage === 'quiz') {
            if (currentQuizQuestionIndex > 0) {
                // Go back to previous question
                return { currentQuizQuestionIndex: currentQuizQuestionIndex - 1 };
            } else {
                // Go back from first quiz question to practice (if exists) or lesson
                if (hasPracticeItems) {
                    return { learningStage: 'practice' };
                } else {
                    return { learningStage: 'lesson' };
                }
            }
        } else if (learningStage === 'results') {
            if (currentResultItemIndex > 0) {
                // Go back through result items
                return { currentResultItemIndex: currentResultItemIndex - 1 };
            } else {
                // Go back from results summary to last quiz question
                if (quiz && state.totalQuizQuestions > 0) {
                   return { learningStage: 'quiz', currentQuizQuestionIndex: state.totalQuizQuestions - 1 };
                } else if (hasPracticeItems) { // Fallback to practice if no quiz
                   return { learningStage: 'practice' };
                } else { // Fallback to lesson if no quiz/practice
                   return { learningStage: 'lesson' };
                }
            }
        }
        // Cannot go back from 'lesson' or 'complete'
        return {};
    }),

  resetSession: () => set({
    sessionId: null,
    vectorStoreId: null,
    uploadedFiles: [],
    lessonPlan: null,
    lessonContent: null,
    quiz: null,
    quizFeedback: null,
    sessionAnalysis: null,
    userQuizAnswers: {},
    isSubmittingQuiz: false,
    learningStage: 'lesson',
    currentQuizQuestionIndex: 0,
    currentResultItemIndex: 0,
    totalQuizQuestions: 0,
    loadingState: 'idle',
    loadingMessage: '',
    error: null,
  }),
}));