'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast"; // For feedback
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown'; // Needed for rendering markdown content
import remarkGfm from 'remark-gfm'; // Needed for markdown tables, etc.
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/store/sessionStore';
import * as api from '@/lib/api';
import type { 
    LessonContent, 
    Quiz, 
    SectionContent, 
    ExplanationContent, 
    QuizQuestion as QuizQuestionType, 
    QuizFeedback, 
    QuizFeedbackItem, 
    MiniQuizInfo, 
    UserSummaryPromptInfo,
    QuizUserAnswer,
    QuizUserAnswers
} from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner'; // Reuse LoadingSpinner
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Useful for styling chunks
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import MiniQuiz from '@/components/MiniQuiz'; // Reuse MiniQuiz component
import UserSummary from '@/components/UserSummary'; // Reuse UserSummary component
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // For quiz questions
import { Label } from "@/components/ui/label"; // For quiz questions
import { Separator } from "@/components/ui/separator"; // For visual separation
import { Progress } from "@/components/ui/progress"; // For progress indicators

// --- Placeholder Content Chunk Components (Define within LearnPage or import later) ---

const DisplayLessonIntro = ({ lessonContent }: { lessonContent: LessonContent }) => (
    <Card className="h-full flex flex-col"> {/* Use flex column */}
        <CardHeader>
            <CardTitle>{lessonContent.title}</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none flex-grow overflow-y-auto">
             <ReactMarkdown remarkPlugins={[remarkGfm]}>{lessonContent.introduction}</ReactMarkdown>
        </CardContent>
    </Card>
);

const DisplaySectionIntro = ({ section }: { section: SectionContent }) => (
     <Card className="h-full flex flex-col">
        <CardHeader>
            <CardTitle>Section: {section.title}</CardTitle>
        </CardHeader>
         <CardContent className="prose dark:prose-invert max-w-none flex-grow overflow-y-auto">
             <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.introduction}</ReactMarkdown>
        </CardContent>
    </Card>
);

const DisplayExplanation = ({ explanation, sectionTitle }: { explanation: ExplanationContent, sectionTitle: string }) => (
     <Card className="h-full flex flex-col">
        <CardHeader>
             <CardDescription>Topic within {sectionTitle}</CardDescription>
            <CardTitle>{explanation.topic}</CardTitle>
        </CardHeader>
         <CardContent className="prose dark:prose-invert max-w-none space-y-3 flex-grow overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation.explanation}</ReactMarkdown>
               {explanation.examples && explanation.examples.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium text-sm">Examples:</p>
                  <ul className="list-disc list-inside text-sm ml-4">
                    {explanation.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                  </ul>
                </div>
              )}
        </CardContent>
    </Card>
);

const DisplaySectionSummary = ({ section }: { section: SectionContent }) => (
     <Card className="h-full flex flex-col">
        <CardHeader>
            <CardTitle>Summary for Section: {section.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto">
            <p className="text-sm text-muted-foreground">{section.summary}</p>
        </CardContent>
    </Card>
);

const DisplayLessonConclusion = ({ lessonContent }: { lessonContent: LessonContent }) => (
     <Card className="h-full flex flex-col">
        <CardHeader>
            <CardTitle>Lesson Conclusion</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none flex-grow overflow-y-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{lessonContent.conclusion}</ReactMarkdown>
             {lessonContent.next_steps && lessonContent.next_steps.length > 0 && (
                <>
                <p className="font-medium mt-4">Suggested Next Steps:</p>
                <ul className="list-disc list-inside text-sm ml-4">
                    {lessonContent.next_steps.map((step, i) => <li key={i}>{step}</li>)}
                </ul>
                </>
            )}
        </CardContent>
    </Card>
);

interface QuizQuestionProps {
    question: QuizQuestionType;
    index: number;
    total: number;
    onAnswerChange: (value: string) => void;
    selectedValue: string | undefined;
}

const QuizQuestion = ({
    question,
    index,
    total,
    onAnswerChange,
    selectedValue
}: QuizQuestionProps) => (
     <Card className="h-full flex flex-col">
        <CardHeader>
            <CardDescription>Question {index + 1} of {total} ({question.difficulty})</CardDescription>
            <CardTitle>{question.question}</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto">
            <RadioGroup
                value={selectedValue}
                onValueChange={onAnswerChange}
                className="flex flex-col space-y-4"
            >
                {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center space-x-2 my-2 p-2 border rounded hover:bg-accent">
                        <RadioGroupItem value={optionIndex.toString()} id={`q${index}-opt${optionIndex}`} />
                        <Label htmlFor={`q${index}-opt${optionIndex}`} className="cursor-pointer flex-1">{option}</Label>
                    </div>
                ))}
            </RadioGroup>
        </CardContent>
    </Card>
);

const DisplayResultsSummary = ({ feedback }: { feedback: QuizFeedback }) => {
     const scoreColor = feedback.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>Quiz Results: {feedback.quiz_title}</CardTitle>
                 <CardDescription>Overall Performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-grow overflow-y-auto">
                 <div className="flex justify-between items-baseline">
                    <span className="text-muted-foreground">Score:</span>
                    <span className={`text-2xl font-bold ${scoreColor}`}>
                    {feedback.correct_answers} / {feedback.total_questions} ({feedback.score_percentage.toFixed(1)}%)
                    </span>
                 </div>
                 <div>
                    <h4 className="font-semibold mb-1 text-sm">Overall Feedback:</h4>
                    <p className="text-sm text-muted-foreground">{feedback.overall_feedback}</p>
                 </div>
            </CardContent>
        </Card>
    );
};

const DisplayResultFeedbackItem = ({ item, index, total }: { item: QuizFeedbackItem, index: number, total: number }) => (
    <Card className="h-full flex flex-col">
         <CardHeader>
            <CardDescription>Detailed Feedback for Question {item.question_index + 1} of {total}</CardDescription>
             <CardTitle className="text-base">{item.question_text}</CardTitle>
        </CardHeader>
         <CardContent className="text-sm space-y-1 flex-grow overflow-y-auto">
              <p>Your answer: <span className={item.is_correct ? "text-green-600" : "text-red-600"}>{item.user_selected_option}</span></p>
              <p>Correct answer: <span className="text-green-600">{item.correct_option}</span></p>
              <p className="text-muted-foreground pt-1"><span className="font-medium">Explanation:</span> {item.explanation}</p>
               {!item.is_correct && item.improvement_suggestion && (
                  <p className="text-blue-600 dark:text-blue-400 pt-1"><span className="font-medium">Suggestion:</span> {item.improvement_suggestion}</p>
                )}
        </CardContent>
    </Card>
);

const DisplayError = ({ message }: { message: string }) => (
     <Card className="h-full flex flex-col border-destructive">
        <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto">
            <p>{message}</p>
        </CardContent>
    </Card>
);

type StepContent = 
    | { type: 'error'; data: string }
    | { type: 'lessonIntro'; data: LessonContent }
    | { type: 'sectionIntro'; data: SectionContent }
    | { type: 'explanation'; data: ExplanationContent; sectionTitle: string }
    | { type: 'miniQuiz'; data: QuizQuestionType }
    | { type: 'userSummary'; data: { sectionTitle: string; topic: string } }
    | { type: 'sectionSummary'; data: SectionContent }
    | { type: 'lessonConclusion'; data: LessonContent }
    | { type: 'quizQuestion'; data: QuizQuestionType }
    | { type: 'resultsSummary'; data: QuizFeedback }
    | { type: 'resultItem'; data: QuizFeedbackItem; index: number; total: number };

// --- New Components for Grouped Views ---

const DisplayFullLesson = ({ lessonContent }: { lessonContent: LessonContent }) => (
    <div className="h-full overflow-y-auto p-1"> {/* Scrollable container */}
        {/* Lesson Intro */}
        <Card className="mb-6">
            <CardHeader>
                <CardTitle>{lessonContent.title}</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{lessonContent.introduction}</ReactMarkdown>
            </CardContent>
        </Card>

        {/* Sections */}
        {lessonContent.sections.map((section, index) => (
            <Card key={index} className="mb-6 border-l-4 border-primary/30"> {/* Visually group sections */}
                <CardHeader>
                    <CardTitle>Section {index + 1}: {section.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="prose dark:prose-invert max-w-none text-sm text-muted-foreground pl-2 border-l-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.introduction}</ReactMarkdown>
                    </div>
                    {/* Explanations */}
                    {section.explanations.map((explanation, expIndex) => (
                         <div key={expIndex} className="ml-4 border-l-2 pl-4 pt-2 pb-2">
                           <p className="font-semibold">{explanation.topic}</p>
                           <div className="prose dark:prose-invert max-w-none text-sm">
                               <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation.explanation}</ReactMarkdown>
                           </div>
                            {explanation.examples && explanation.examples.length > 0 && (
                                <div className="mt-2">
                                <p className="font-medium text-xs text-muted-foreground">Examples:</p>
                                <ul className="list-disc list-inside text-xs ml-4">
                                    {explanation.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                                </ul>
                                </div>
                            )}
                        </div>
                    ))}
                     {/* Section Summary */}
                     <div className="mt-4 pt-4 border-t">
                         <p className="font-semibold text-sm">Section Summary</p>
                         <p className="text-sm text-muted-foreground">{section.summary}</p>
                     </div>
                </CardContent>
            </Card>
        ))}

        {/* Lesson Conclusion */}
        <DisplayLessonConclusion lessonContent={lessonContent} />
    </div>
);

// --- Type for the Current View (based on the *specific* step) ---
type CurrentViewData =
  | { type: 'loading'; message: string }
  | { type: 'error'; data: string }
  | { type: 'lessonIntro'; data: LessonContent }
  | { type: 'sectionIntro'; data: SectionContent }
  | { type: 'explanation'; data: ExplanationContent; sectionTitle: string }
  | { type: 'miniQuiz'; data: QuizQuestionType; sectionTitle: string; topic: string }
  | { type: 'userSummary'; data: { sectionTitle: string; topic: string } }
  | { type: 'sectionSummary'; data: SectionContent }
  | { type: 'lessonConclusion'; data: LessonContent }
  | { type: 'quizQuestion'; data: QuizQuestionType; index: number; total: number }
  | { type: 'resultsSummary'; data: QuizFeedback }
  | { type: 'resultItem'; data: QuizFeedbackItem; index: number; total: number }
  | { type: 'complete' };

// --- Component to render the practice items ---
const DisplayPracticeItems = ({ miniQuizzes, userSummaries }: { miniQuizzes: MiniQuizInfo[] | null, userSummaries: UserSummaryPromptInfo[] | null }) => (
    <div className="h-full overflow-y-auto p-1 space-y-6"> {/* Scrollable container */}
         <Card>
            <CardHeader><CardTitle>Practice Time!</CardTitle></CardHeader>
            <CardContent><CardDescription>Let's reinforce what you've learned with some quick checks and summaries.</CardDescription></CardContent>
         </Card>

        {/* Render Mini Quizzes */}
        {miniQuizzes && miniQuizzes.length > 0 && (
             <Card className="bg-secondary/30">
                <CardHeader><CardTitle className="text-lg">Quick Checks</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {miniQuizzes.map((mqInfo, index) => (
                         <MiniQuiz key={`mq-${index}`} question={mqInfo.quiz_question} />
                    ))}
                </CardContent>
            </Card>
        )}

        {/* Render User Summaries */}
         {userSummaries && userSummaries.length > 0 && (
            <Card className="bg-blue-50 dark:bg-blue-900/20">
                <CardHeader><CardTitle className="text-lg">Summarize Key Concepts</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {userSummaries.map((usInfo, index) => (
                        <UserSummary key={`us-${index}`} sectionTitle={usInfo.section_title} topic={usInfo.topic} />
                    ))}
                </CardContent>
            </Card>
         )}

         {(!miniQuizzes || miniQuizzes.length === 0) && (!userSummaries || userSummaries.length === 0) && (
            <Alert>
                <AlertTitle>No Practice Items</AlertTitle>
                <AlertDescription>There are no interactive practice items for this lesson. Proceed to the final quiz when ready.</AlertDescription>
            </Alert>
         )}
    </div>
);

export default function LearnPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const sessionId = typeof params.sessionId === 'string' ? params.sessionId : null;

    // --- Select state and actions individually ---
    const lessonContent = useSessionStore(state => state.lessonContent);
    const quiz = useSessionStore(state => state.quiz);
    const quizFeedback = useSessionStore(state => state.quizFeedback);
    const loadingState = useSessionStore(state => state.loadingState);
    const error = useSessionStore(state => state.error);
    const loadingMessage = useSessionStore(state => state.loadingMessage);
    const learningSteps = useSessionStore(state => state.learningSteps);
    const currentStepIndex = useSessionStore(state => state.currentStepIndex);
    const userQuizAnswers = useSessionStore(state => state.userQuizAnswers);
    const isSubmittingQuiz = useSessionStore(state => state.isSubmittingQuiz);

    // Select actions (references are stable)
    const initializeLearningSteps = useSessionStore(state => state.initializeLearningSteps);
    const setLoading = useSessionStore(state => state.setLoading);
    const setError = useSessionStore(state => state.setError);
    const setQuiz = useSessionStore(state => state.setQuiz);
    const setLessonContent = useSessionStore(state => state.setLessonContent);
    const setQuizFeedback = useSessionStore(state => state.setQuizFeedback);
    const setUserQuizAnswer = useSessionStore(state => state.setUserQuizAnswer);
    const setIsSubmittingQuiz = useSessionStore(state => state.setIsSubmittingQuiz);
    const goToNextStep = useSessionStore(state => state.goToNextStep);
    const goToPreviousStep = useSessionStore(state => state.goToPreviousStep);

    const [localLoading, setLocalLoading] = useState(true);
    const [hasInitialized, setHasInitialized] = useState(false);
    const [currentQuizAnswer, setCurrentQuizAnswer] = useState<string | undefined>(undefined);
    const isFetchingRef = useRef(false);

    // --- Data Fetching Effect (Modified Dependencies) ---
    useEffect(() => {
        if (!sessionId) {
            setError('Invalid session ID.');
            setLocalLoading(false);
            return;
        }

        // Fetch only if needed and not already fetching/initialized
        const storeState = useSessionStore.getState();
        if (sessionId && (!storeState.lessonContent || !storeState.quiz) && !isFetchingRef.current && !hasInitialized) {
            const fetchLearnData = async () => {
                isFetchingRef.current = true;
                setLocalLoading(true);
                setLoading('loading', 'Loading learning materials...');
                setError(null);

                try {
                    const [lessonData, quizData] = await Promise.all([
                        api.getLessonContent(sessionId),
                        api.getQuiz(sessionId)
                    ]);

                    if (!lessonData) {
                         throw new Error(`Failed to fetch lesson content.`);
                    }

                    setLessonContent(lessonData);
                    setQuiz(quizData);
                    setLoading('success');
                    console.log("Lesson and Quiz data loaded. Initializing steps...");
                    initializeLearningSteps(lessonData, quizData, null);
                    setHasInitialized(true);

                } catch (err: any) {
                    console.error("Failed to fetch learning data:", err);
                    const errorMessage = err.response?.data?.detail || err.message || 'Failed to load learning materials.';
                    setError(errorMessage);
                    setLoading('error', errorMessage);
                } finally {
                    setLocalLoading(false);
                    isFetchingRef.current = false;
                }
            };
            fetchLearnData();
        } else {
            // Handle cases where data might exist but steps aren't initialized
            const storeState = useSessionStore.getState();
             if (storeState.lessonContent && storeState.learningSteps.length === 0 && !hasInitialized && !isFetchingRef.current && loadingState !== 'loading') {
                  console.log("Re-initializing steps from existing content (effect).");
                  initializeLearningSteps(storeState.lessonContent, storeState.quiz, storeState.quizFeedback);
                  setHasInitialized(true);
             }
             if (localLoading) {
                 setLocalLoading(false);
             }
        }
    }, [sessionId, hasInitialized, initializeLearningSteps, setError, setLoading, setQuiz, setLessonContent, loadingState]);

    // --- Effect to load stored answer for Quiz Questions ---
    useEffect(() => {
        const currentStep = learningSteps[currentStepIndex];
        if (currentStep?.type === 'quizQuestion') {
            setCurrentQuizAnswer(userQuizAnswers[currentStep.quizQuestionIndex]?.toString());
        } else {
            setCurrentQuizAnswer(undefined);
        }
    }, [currentStepIndex, learningSteps, userQuizAnswers]);

    // --- Determine the current view based on the current step index ---
    const getCurrentView = (): CurrentViewData => {
        if (loadingState === 'error') {
            return { type: 'error', data: error || 'An unknown error occurred' };
        }

        if (localLoading || loadingState === 'loading' || !hasInitialized || learningSteps.length === 0) {
            return { type: 'loading', message: loadingMessage || 'Initializing...' };
        }

        if (currentStepIndex >= learningSteps.length) {
            return { type: 'complete' };
        }

        const currentStep = learningSteps[currentStepIndex];

        try {
            switch (currentStep.type) {
                case 'lessonIntro':
                    if (!lessonContent) return { type: 'error', data: 'Lesson content missing.' };
                    return { type: 'lessonIntro', data: lessonContent };
                case 'sectionIntro':
                    if (!lessonContent?.sections[currentStep.sectionIndex]) return { type: 'error', data: 'Section data missing.' };
                    return { type: 'sectionIntro', data: lessonContent.sections[currentStep.sectionIndex] };
                case 'explanation':
                    const explSection = lessonContent?.sections[currentStep.sectionIndex];
                    const explanation = explSection?.explanations[currentStep.explanationIndex];
                    if (!explSection || !explanation) return { type: 'error', data: 'Explanation data missing.' };
                    return { type: 'explanation', data: explanation, sectionTitle: explSection.title };
                case 'miniQuiz':
                     const mqSection = lessonContent?.sections[currentStep.sectionIndex];
                     const mqExplanation = mqSection?.explanations[currentStep.explanationIndex];
                     const miniQuizQuestion = mqExplanation?.mini_quiz?.[currentStep.quizIndex];
                     if (!mqSection || !mqExplanation || !miniQuizQuestion) return { type: 'error', data: 'Mini-quiz data missing.' };
                     return { type: 'miniQuiz', data: miniQuizQuestion, sectionTitle: mqSection.title, topic: mqExplanation.topic };
                case 'userSummary':
                     const usSection = lessonContent?.sections[currentStep.sectionIndex];
                     const usExplanation = usSection?.explanations[currentStep.explanationIndex];
                     if (!usSection || !usExplanation) return { type: 'error', data: 'User summary context missing.' };
                    return { type: 'userSummary', data: { sectionTitle: usSection.title, topic: usExplanation.topic } };
                case 'sectionSummary':
                    if (!lessonContent?.sections[currentStep.sectionIndex]) return { type: 'error', data: 'Section summary data missing.' };
                    return { type: 'sectionSummary', data: lessonContent.sections[currentStep.sectionIndex] };
                case 'lessonConclusion':
                    if (!lessonContent) return { type: 'error', data: 'Lesson conclusion missing.' };
                    return { type: 'lessonConclusion', data: lessonContent };
                case 'quizQuestion':
                    const question = quiz?.questions[currentStep.quizQuestionIndex];
                    if (!quiz || !question) return { type: 'error', data: 'Quiz question missing.' };
                    return { type: 'quizQuestion', data: question, index: currentStep.quizQuestionIndex, total: quiz.questions.length };
                case 'resultsSummary':
                    if (!quizFeedback) return { type: 'error', data: 'Quiz feedback missing.' };
                    return { type: 'resultsSummary', data: quizFeedback };
                case 'resultItem':
                    const feedbackItem = quizFeedback?.feedback_items[currentStep.resultItemIndex];
                    if (!quizFeedback || !feedbackItem) return { type: 'error', data: 'Quiz feedback item missing.' };
                    return { type: 'resultItem', data: feedbackItem, index: currentStep.resultItemIndex, total: quizFeedback.feedback_items.length };
                default:
                    return { type: 'error', data: `Unknown step type: ${(currentStep as any).type}` };
            }
        } catch (e: any) {
             console.error("Error getting current view:", e);
             return { type: 'error', data: `Error processing step ${currentStepIndex}: ${e.message}` };
        }
    };

    // --- Interaction Handlers ---
    const handleNextClick = async () => {
        if (isSubmittingQuiz || loadingState === 'loading') return;

        const currentStep = learningSteps[currentStepIndex];

        if (currentStep?.type === 'quizQuestion') {
            if (currentQuizAnswer !== undefined) {
                setUserQuizAnswer(currentStep.quizQuestionIndex, parseInt(currentQuizAnswer));
            } else {
                 toast({ title: "Please select an answer", variant: "destructive" });
                 return;
            }

            const isLastQuizQuestion = !learningSteps[currentStepIndex + 1] || learningSteps[currentStepIndex + 1].type !== 'quizQuestion';

            if (isLastQuizQuestion) {
                console.log("Submitting quiz...");
                setIsSubmittingQuiz(true);
                try {
                    const answers: QuizUserAnswer[] = Object.entries(userQuizAnswers).map(([qIndex, ansIndex]) => ({
                        question_index: parseInt(qIndex),
                        selected_option_index: ansIndex
                    }));

                    if (!quiz) { throw new Error("Quiz data is missing."); }

                    const submission: QuizUserAnswers = { quiz_title: quiz.title, user_answers: answers };
                    const feedback = await api.submitQuiz(sessionId!, submission);
                    setQuizFeedback(feedback);
                    console.log("Quiz submitted, feedback received.");
                } catch (error: any) {
                    console.error('Error submitting quiz:', error);
                    setError(`Failed to submit quiz: ${error.message || 'Unknown error'}`);
                    toast({ title: "Quiz Submission Failed", description: error.message || 'Please try again.', variant: "destructive" });
                } finally {
                    setIsSubmittingQuiz(false);
                }
                return;
            }
        }

        goToNextStep();
    };

     const handlePreviousClick = () => {
         if (isSubmittingQuiz || loadingState === 'loading') return;
         goToPreviousStep();
     };

    // --- Determine Button States ---
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex >= learningSteps.length - 1;

    const currentStep = learningSteps[currentStepIndex];
    const isQuizQuestionStep = currentStep?.type === 'quizQuestion';

    const isNextDisabled = isSubmittingQuiz || loadingState === 'loading' || isLastStep ||
                           (isQuizQuestionStep && currentQuizAnswer === undefined);

    const isPrevDisabled = isSubmittingQuiz || loadingState === 'loading' || isFirstStep;

    // Get the current view to render
    const currentView = getCurrentView();

    // --- Loading and Error States ---
    if (currentView.type === 'loading') {
        return (
            <div className="flex items-center justify-center w-full h-full">
                <LoadingSpinner message={currentView.message} />
            </div>
        );
    }

    if (currentView.type === 'error') {
        return (
            <div className="flex items-center justify-center w-full h-full p-4">
                <Alert variant="destructive" className="w-full max-w-lg">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Error in Learning Session</AlertTitle>
                    <AlertDescription>{currentView.data}</AlertDescription>
                    <Button onClick={() => router.push('/')} variant="link" className="mt-2 -ml-4">Go back to start</Button>
                </Alert>
            </div>
        );
    }

    // --- Main Layout ---
     return (
        <div className="flex h-screen bg-muted/40">
            <div className="w-1/6 lg:w-1/5 flex-shrink-0 bg-gray-100 dark:bg-gray-900/50 border-r border-border/50">
                <div className="p-4 h-full">
                     <p className="text-sm font-medium text-muted-foreground">Progress</p>
                     <p className="text-xs text-muted-foreground">Step {currentStepIndex + 1} of {learningSteps.length}</p>
                </div>
            </div>

            <div className="flex-grow flex flex-col overflow-hidden">
                <div className="flex-grow p-4 md:p-6 bg-background overflow-hidden relative">
                     <div className="h-full">
                        {currentView.type === 'lessonIntro' && <DisplayLessonIntro lessonContent={currentView.data} />}
                        {currentView.type === 'sectionIntro' && <DisplaySectionIntro section={currentView.data} />}
                        {currentView.type === 'explanation' && <DisplayExplanation explanation={currentView.data} sectionTitle={currentView.sectionTitle} />}
                        {currentView.type === 'miniQuiz' && <MiniQuiz question={currentView.data} />}
                        {currentView.type === 'userSummary' && <UserSummary sectionTitle={currentView.data.sectionTitle} topic={currentView.data.topic} />}
                        {currentView.type === 'sectionSummary' && <DisplaySectionSummary section={currentView.data} />}
                        {currentView.type === 'lessonConclusion' && <DisplayLessonConclusion lessonContent={currentView.data} />}
                        {currentView.type === 'quizQuestion' && (
                            <QuizQuestion
                                question={currentView.data}
                                index={currentView.index}
                                total={currentView.total}
                                selectedValue={currentQuizAnswer}
                                onAnswerChange={(value) => setCurrentQuizAnswer(value)}
                            />
                        )}
                        {currentView.type === 'resultsSummary' && <DisplayResultsSummary feedback={currentView.data} />}
                        {currentView.type === 'resultItem' && <DisplayResultFeedbackItem item={currentView.data} index={currentView.index} total={currentView.total} />}
                        {currentView.type === 'complete' && (
                             <Card className="h-full flex flex-col items-center justify-center">
                                <CardHeader><CardTitle>Lesson Complete!</CardTitle></CardHeader>
                                <CardContent>
                                     <CardDescription>You have finished this learning session.</CardDescription>
                                     <Button className="mt-4" onClick={() => router.push(`/session/${sessionId}/analysis`)}>View Session Analysis</Button>
                                 </CardContent>
                            </Card>
                        )}
                    </div>
                </div>

                <div className="p-3 md:p-4 border-t bg-card flex justify-between items-center flex-shrink-0">
                    <Button variant="outline" onClick={handlePreviousClick} disabled={isPrevDisabled}>Previous</Button>
                    {currentView.type !== 'complete' && (
                        <Button onClick={handleNextClick} disabled={isNextDisabled}>
                             {isSubmittingQuiz
                                ? 'Submitting...'
                                : (currentStep?.type === 'quizQuestion' && !learningSteps[currentStepIndex + 1]?.type.startsWith('quiz'))
                                    ? 'Submit Quiz'
                                    : 'Next'
                             }
                        </Button>
                    )}
                     {currentView.type === 'complete' && (
                         <Button onClick={() => router.push('/')}>Start New Session</Button>
                     )}
                </div>
            </div>
        </div>
    );
} 