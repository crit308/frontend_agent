// Corresponds to ai_tutor/agents/models.py

export interface LearningObjective {
  title: string;
  description: string;
  priority: number;
}

export interface LessonSection {
  title: string;
  objectives: LearningObjective[];
  estimated_duration_minutes: number;
  concepts_to_cover: string[];
}

export interface LessonPlan {
  title: string;
  description: string;
  target_audience: string;
  prerequisites: string[];
  sections: LessonSection[];
  total_estimated_duration_minutes: number;
  additional_resources?: string[];
}

// --- Lesson Content ---

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer_index: number;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  related_section: string;
}

export interface ExplanationContent {
  topic: string;
  explanation: string;
  examples: string[];
  mini_quiz?: QuizQuestion[]; // Optional mini-quiz embedded
}

export interface Exercise {
  question: string;
  difficulty_level: 'Easy' | 'Medium' | 'Hard';
  answer: string; // Consider if the answer should be sent to the frontend initially
  explanation: string;
}

export interface SectionContent {
  title: string;
  introduction: string;
  explanations: ExplanationContent[];
  exercises: Exercise[];
  summary: string;
}

export interface LessonContent {
  title: string;
  introduction: string;
  sections: SectionContent[];
  conclusion: string;
  next_steps: string[];
  mini_quizzes?: MiniQuizInfo[];
  user_summary_prompts?: UserSummaryPromptInfo[];
}

// Practice Phase Types
export interface MiniQuizInfo {
  related_section_title: string;
  related_topic: string;
  quiz_question: QuizQuestion;
}

export interface UserSummaryPromptInfo {
  section_title: string;
  topic: string;
}

// --- Quiz & Feedback ---

export interface Quiz {
  title: string;
  description: string;
  lesson_title: string;
  questions: QuizQuestion[];
  passing_score: number;
  total_points: number;
  estimated_completion_time_minutes: number;
}

export interface QuizUserAnswer {
  question_index: number;
  selected_option_index: number;
  time_taken_seconds?: number; // Optional based on requirements
}

export interface QuizUserAnswers {
  quiz_title: string;
  user_answers: QuizUserAnswer[];
  total_time_taken_seconds?: number; // Optional
}

export interface QuizFeedbackItem {
  question_index: number;
  question_text: string;
  user_selected_option: string;
  is_correct: boolean;
  correct_option: string;
  explanation: string;
  improvement_suggestion?: string;
}

export interface QuizFeedback {
  quiz_title: string;
  total_questions: number;
  correct_answers: number;
  score_percentage: number;
  passed: boolean;
  total_time_taken_seconds?: number;
  feedback_items: QuizFeedbackItem[];
  overall_feedback: string;
  suggested_study_topics: string[];
  next_steps: string[];
}

// --- Session & Analysis ---

export interface LearningInsight {
  topic: string;
  observation: string;
  strength: boolean;
  recommendation: string;
}

export interface TeachingInsight {
  approach: string;
  effectiveness: string;
  evidence: string;
  suggestion: string;
}

export interface SessionAnalysis {
  session_id: string;
  session_duration_seconds: number;
  overall_effectiveness: number; // Assuming 0-100 scale as in backend
  strengths: string[];
  improvement_areas: string[];
  lesson_plan_quality: number;
  lesson_plan_insights: string[];
  content_quality: number;
  content_insights: string[];
  quiz_quality: number;
  quiz_insights: string[];
  student_performance: number;
  learning_insights: LearningInsight[];
  teaching_effectiveness: number;
  teaching_insights: TeachingInsight[];
  recommendations: string[];
  recommended_adjustments: string[];
  suggested_resources: string[];
}

// API Response Types (adjust as needed based on your actual API)
export interface StartSessionResponse {
  session_id: string;
  message: string;
}

export interface UploadDocumentsResponse {
  vector_store_id: string | null;
  files_received: string[];
  analysis_status: string;
  message: string;
}

// Generic types for API state
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';