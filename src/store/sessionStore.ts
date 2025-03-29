import { create } from 'zustand';
import {
  LessonPlan,
  LessonContent,
  Quiz,
  QuizFeedback,
  SessionAnalysis,
  QuizUserAnswers, // Needed for submission
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
        // count += section.exercises.length; // Exercises might be grouped or skipped in step-by-step
        count++; // Section Summary
    });
    count++; // Lesson Conclusion
    return count;
};

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
  userQuizAnswers: { [key: number]: number }; // Store answers: { questionIndex: selectedOptionIndex }
  isSubmittingQuiz: boolean; // Track quiz submission API call
  learningStage: 'intro' | 'lesson' | 'quiz' | 'results' | 'conclusion' | 'complete';
  currentLessonSectionIndex: number;
  currentLessonItemIndex: number; // Represents item within a section (explanation, quiz, summary) or top-level items
  currentQuizQuestionIndex: number;
  currentResultItemIndex: number; // For paginating results feedback
  totalLessonItems: number; // Rough count for potential progress calculation
  totalQuizQuestions: number;
  currentStep: 'upload' | 'generating' | 'lesson' | 'quiz' | 'results' | 'analysis';
  loadingState: LoadingState;
  loadingMessage: string;
  error: string | null;

  // Actions
  setSessionId: (sessionId: string) => void;
  setVectorStoreId: (vectorStoreId: string | null) => void;
  setUploadedFiles: (files: File[]) => void;
  setLessonPlan: (plan: LessonPlan | null) => void;
  setLessonContent: (content: LessonContent | null) => void;
  setQuiz: (quiz: Quiz | null) => void;
  setQuizFeedback: (feedback: QuizFeedback | null) => void;
  setUserQuizAnswer: (questionIndex: number, answerIndex: number) => void;
  setSessionAnalysis: (analysis: SessionAnalysis | null) => void;
  setCurrentStep: (step: SessionState['currentStep']) => void;
  setLoading: (state: LoadingState, message?: string) => void;
  setError: (error: string | null) => void;
  setLearningStage: (stage: SessionState['learningStage']) => void;
  initializeStepIndices: (lessonContent: LessonContent | null, quiz: Quiz | null) => void;
  goToNextStep: () => void; // Basic structure, logic refinement in Phase 3/4
  goToPreviousStep: () => void; // Basic structure
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  // Initial State
  sessionId: null,
  vectorStoreId: null,
  uploadedFiles: [],
  lessonPlan: null,
  lessonContent: null,
  userQuizAnswers: {},
  isSubmittingQuiz: false,
  learningStage: 'intro',
  currentLessonSectionIndex: -1,
  currentLessonItemIndex: 0,
  currentQuizQuestionIndex: 0,
  currentResultItemIndex: 0,
  totalLessonItems: 0,
  totalQuizQuestions: 0,
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
  setUserQuizAnswer: (questionIndex, answerIndex) => set((state) => ({
      userQuizAnswers: {
          ...state.userQuizAnswers,
          [questionIndex]: answerIndex,
      },
  })),
  setSessionAnalysis: (analysis) => set({ sessionAnalysis: analysis }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setLoading: (state, message = '') => set({ loadingState: state, loadingMessage: message, error: state === 'error' ? message : null }),
  setError: (error) => set({ error: error, loadingState: error ? 'error' : 'idle' }),
  setLearningStage: (stage) => set({ learningStage: stage }),
  
  initializeStepIndices: (lessonContent, quiz) => set((state) => {
      const numLessonItems = countLessonItems(lessonContent);
      const numQuizQuestions = quiz?.questions?.length ?? 0;
      return {
        lessonContent: lessonContent ?? state.lessonContent,
        quiz: quiz ?? state.quiz,
        learningStage: 'intro',
        currentLessonSectionIndex: -1,
        currentLessonItemIndex: 0,
        currentQuizQuestionIndex: 0,
        currentResultItemIndex: 0,
        totalLessonItems: numLessonItems,
        totalQuizQuestions: numQuizQuestions,
      };
  }),
  
  // --- Navigation Logic (Refined for Phase 4) ---
  goToNextStep: () => set((state) => {
      const { lessonContent, quiz, learningStage, currentLessonSectionIndex, currentLessonItemIndex, currentQuizQuestionIndex, currentResultItemIndex, totalQuizQuestions, quizFeedback } = state;

      if (learningStage === 'intro') {
          // Move from lesson intro to the first section's intro
          if (lessonContent && lessonContent.sections.length > 0) {
                return { learningStage: 'lesson', currentLessonSectionIndex: 0, currentLessonItemIndex: 0 };
          } else { // No sections, maybe jump to conclusion?
                return { learningStage: 'conclusion', currentLessonSectionIndex: -1, currentLessonItemIndex: 0 };
          }
      }
      else if (learningStage === 'lesson') {
           if (!lessonContent) return {}; // Should not happen if stage is 'lesson'
           const section = lessonContent.sections[currentLessonSectionIndex];
           let maxItemIndex = 0; // Section Intro
           section.explanations.forEach(exp => {
               maxItemIndex++; // Explanation
               if (exp.mini_quiz && exp.mini_quiz.length > 0) maxItemIndex++; // MiniQuiz
               maxItemIndex++; // UserSummary
           });
           // maxItemIndex++; // Exercises (if added)
           maxItemIndex++; // Section Summary

           if (currentLessonItemIndex < maxItemIndex) {
               // Advance within the section
               return { currentLessonItemIndex: currentLessonItemIndex + 1 };
           } else {
               // Move to the next section or to conclusion
               if (currentLessonSectionIndex < lessonContent.sections.length - 1) {
                   // Go to next section's intro
                   return { currentLessonSectionIndex: currentLessonSectionIndex + 1, currentLessonItemIndex: 0 };
               } else {
                   // Finished last section, go to lesson conclusion
                   return { learningStage: 'conclusion', currentLessonSectionIndex: -1, currentLessonItemIndex: 0 };
               }
           }
      }
      else if (learningStage === 'conclusion') {
          // After lesson conclusion, move to quiz
          if (quiz && totalQuizQuestions > 0) {
             return { learningStage: 'quiz', currentQuizQuestionIndex: 0 };
          } else {
             // No quiz, maybe mark as complete?
             return { learningStage: 'complete' };
          }
      }
      else if (learningStage === 'quiz') {
         // Logic for quiz submission is handled in the component now
         if (currentQuizQuestionIndex < totalQuizQuestions - 1) {
             // Go to next question
             return { currentQuizQuestionIndex: currentQuizQuestionIndex + 1 };
         } else {
             // Last question was just answered, component will trigger submission
             // Do nothing here, wait for submission result to change stage
             console.log("On last quiz question, submission should be triggered by component.");
             return {};
         }
      } else if (state.learningStage === 'results') {
         // Navigate through result items (Summary + Feedback Items)
         const totalResultItems = (quizFeedback?.feedback_items?.length ?? 0) + 1; // +1 for summary
         if (currentResultItemIndex < totalResultItems - 1) {
            return { currentResultItemIndex: currentResultItemIndex + 1 };
         } else {
            // Reached end of results pagination
            // Optionally move to a final 'complete' state or analysis trigger
            console.log("End of results reached.");
             return { learningStage: 'complete' }; // Example: Mark as complete
         }
      }
      return {}; // Default no change
  }),

  goToPreviousStep: () => set((state) => {
        const { lessonContent, quiz, learningStage, currentLessonSectionIndex, currentLessonItemIndex, currentQuizQuestionIndex, currentResultItemIndex } = state;

       if (learningStage === 'lesson') {
            if (currentLessonItemIndex > 0) {
                // Go back within the current section
                return { currentLessonItemIndex: currentLessonItemIndex - 1 };
            } else {
                // At the start of a section, go to the previous section's *last* item or to intro
                if (currentLessonSectionIndex > 0) {
                    const prevSectionIndex = currentLessonSectionIndex - 1;
                    const prevSection = lessonContent!.sections[prevSectionIndex];
                    // Calculate last item index of previous section (similar to goToNextStep logic)
                     let maxPrevItemIndex = 0;
                     prevSection.explanations.forEach(exp => {maxPrevItemIndex+=2; if(exp.mini_quiz) maxPrevItemIndex++;});
                     maxPrevItemIndex++; // Section Summary
                    return { currentLessonSectionIndex: prevSectionIndex, currentLessonItemIndex: maxPrevItemIndex };
                } else {
                    // Go back to lesson intro
                    return { learningStage: 'intro', currentLessonSectionIndex: -1, currentLessonItemIndex: 0 };
                }
            }
       } else if (learningStage === 'conclusion') {
            // Go back to the last item of the last lesson section
            if (lessonContent && lessonContent.sections.length > 0) {
                 const lastSectionIndex = lessonContent.sections.length - 1;
                 const lastSection = lessonContent.sections[lastSectionIndex];
                 let maxLastItemIndex = 0;
                 lastSection.explanations.forEach(exp => {maxLastItemIndex+=2; if(exp.mini_quiz) maxLastItemIndex++;});
                 maxLastItemIndex++; // Section Summary
                 return { learningStage: 'lesson', currentLessonSectionIndex: lastSectionIndex, currentLessonItemIndex: maxLastItemIndex };
            } else { // No sections, go back to intro
                 return { learningStage: 'intro', currentLessonSectionIndex: -1, currentLessonItemIndex: 0 };
            }
       } else if (learningStage === 'quiz') {
           if (currentQuizQuestionIndex > 0) {
               // Go back to previous question
               return { currentQuizQuestionIndex: currentQuizQuestionIndex - 1 };
           } else {
               // Go back from first question to lesson conclusion
               return { learningStage: 'conclusion', currentLessonSectionIndex: -1, currentLessonItemIndex: 0 };
           }
       } else if (learningStage === 'results') {
           if (currentResultItemIndex > 0) {
               // Go back through result items
               return { currentResultItemIndex: currentResultItemIndex - 1 };
           } else {
               // Go back from results summary to last quiz question (allow review?)
               // Or maybe prevent going back from results? Design choice.
               // Example: Go back to last quiz question
               if (quiz && state.totalQuizQuestions > 0) {
                  return { learningStage: 'quiz', currentQuizQuestionIndex: state.totalQuizQuestions - 1 };
               } else { // Fallback to conclusion if no quiz
                   return { learningStage: 'conclusion', currentLessonSectionIndex: -1, currentLessonItemIndex: 0 };
               }
           }
       }
      // Cannot go back from 'intro' or 'complete'
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
    learningStage: 'intro',
    currentLessonSectionIndex: -1,
    currentLessonItemIndex: 0,
    currentQuizQuestionIndex: 0,
    currentResultItemIndex: 0,
    totalLessonItems: 0,
    totalQuizQuestions: 0,
    currentStep: 'upload',
    loadingState: 'idle',
    loadingMessage: '',
    error: null,
  }),
})); 