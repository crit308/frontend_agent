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

// Type definition for the current step/view being displayed
type CurrentView =
    | { type: 'error'; data: string }
    | { type: 'lesson'; data: LessonContent }
    | { type: 'practice'; miniQuizzes: MiniQuizInfo[]; userSummaries: UserSummaryPromptInfo[] }
    | { type: 'quizQuestion'; data: QuizQuestionType }
    | { type: 'resultsSummary'; data: QuizFeedback }
    | { type: 'resultItem'; data: QuizFeedbackItem; index: number; total: number }
    | { type: 'loading'; message: string }
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

    // --- Select state slices individually from Zustand ---
    const lessonContent = useSessionStore(state => state.lessonContent);
    const quiz = useSessionStore(state => state.quiz);
    const miniQuizzes = useSessionStore(state => state.miniQuizzes); // Get new state
    const userSummaries = useSessionStore(state => state.userSummaries); // Get new state
    const quizFeedback = useSessionStore(state => state.quizFeedback);
    const loadingState = useSessionStore(state => state.loadingState);
    const error = useSessionStore(state => state.error);
    const loadingMessage = useSessionStore(state => state.loadingMessage);
    const learningStage = useSessionStore(state => state.learningStage);
    const currentQuizQuestionIndex = useSessionStore(state => state.currentQuizQuestionIndex);
    const currentResultItemIndex = useSessionStore(state => state.currentResultItemIndex);
    const totalQuizQuestions = useSessionStore(state => state.totalQuizQuestions);
    const userQuizAnswers = useSessionStore(state => state.userQuizAnswers);

    // --- Select actions individually (actions have stable references) ---
    const initializeStepIndices = useSessionStore(state => state.initializeStepIndices);
    const setLoading = useSessionStore(state => state.setLoading);
    const setError = useSessionStore(state => state.setError);
    const setQuiz = useSessionStore(state => state.setQuiz);
    const setLessonContent = useSessionStore(state => state.setLessonContent);
    const setQuizFeedback = useSessionStore(state => state.setQuizFeedback);
    const setUserQuizAnswer = useSessionStore(state => state.setUserQuizAnswer);
    const goToNextStep = useSessionStore(state => state.goToNextStep);
    const goToPreviousStep = useSessionStore(state => state.goToPreviousStep);
    const setLearningStage = useSessionStore(state => state.setLearningStage);

    const [localLoading, setLocalLoading] = useState(true);
    const [hasInitialized, setHasInitialized] = useState(false); // Local flag for initialization
    const [currentQuizAnswer, setCurrentQuizAnswer] = useState<string | undefined>(undefined); // Local state for current question's answer
    const [isSubmitting, setIsSubmitting] = useState(false); // Local submitting state
    const isFetchingRef = useRef(false);

    useEffect(() => {
        if (!sessionId) {
            setError('Invalid session ID.');
            setLocalLoading(false);
            return;
        }

        // Fetch only if data isn't already loaded and not currently fetching
        // Also check if initialization hasn't happened yet to prevent re-runs after successful load
        if (sessionId && (!lessonContent || !quiz) && !isFetchingRef.current && !hasInitialized) {
            const fetchLearnData = async () => {
                isFetchingRef.current = true;
                setLocalLoading(true);
                setLoading('loading', 'Loading learning materials...');
                setError(null);

                try {
                    console.log(`Fetching lesson and quiz for session: ${sessionId}`);
                    // Fetch in parallel
                    const [lessonData, quizData] = await Promise.all([
                        api.getLessonContent(sessionId),
                        api.getQuiz(sessionId)
                    ]);

                    // Check specifically which one failed if needed
                    if (!lessonData || !quizData) {
                        const missing = [];
                        if (!lessonData) missing.push("lesson content");
                        if (!quizData) missing.push("quiz");
                        throw new Error(`Failed to fetch ${missing.join(" or ")}.`);
                    }

                    // Store both lesson content and quiz
                    setLessonContent(lessonData);
                    setQuiz(quizData);
                    setLoading('success');
                    console.log("Lesson and Quiz data loaded successfully. Initializing indices...");
                    initializeStepIndices(lessonData, quizData);
                    setHasInitialized(true); // Mark initialization as complete

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
            // If data exists and initialization is done, ensure localLoading is false.
            if (lessonContent && quiz && hasInitialized && localLoading) {
                setLocalLoading(false);
            }
        }
    }, [sessionId, lessonContent, quiz, hasInitialized, initializeStepIndices, setError, setLoading, setQuiz, setLessonContent]); // Added setLessonContent to dependencies

    // Effect to load the stored answer when navigating back/forth between quiz questions
    useEffect(() => {
        // userQuizAnswers is now selected individually, so this effect is fine
        if (learningStage === 'quiz') {
            setCurrentQuizAnswer(userQuizAnswers[currentQuizQuestionIndex]?.toString());
        }
    }, [currentQuizQuestionIndex, learningStage, userQuizAnswers]);

    // --- Determine the current view based on the learning stage ---
    const getCurrentView = (): CurrentView => {
        if (loadingState === 'error') {
            return { type: 'error', data: error || 'An unknown error occurred' };
        }
        
        if (localLoading || loadingState === 'loading') {
            return { type: 'loading', message: loadingMessage || 'Loading...'};
        }

        if (learningStage === 'lesson') {
             if (!lessonContent) return { type: 'error', data: 'Lesson content not loaded.' };
             return { type: 'lesson', data: lessonContent };
        }

        if (learningStage === 'practice') {
            // Requires miniQuizzes and userSummaries state variables from the store
            if (!miniQuizzes && !userSummaries) return { type: 'error', data: 'Practice items not loaded.'};
            return { type: 'practice', miniQuizzes: miniQuizzes ?? [], userSummaries: userSummaries ?? [] };
        }
        
        if (learningStage === 'quiz') {
            if (!quiz || !quiz.questions || quiz.questions.length <= currentQuizQuestionIndex) {
                return { type: 'error', data: 'Quiz question not available.' };
            }
            return { type: 'quizQuestion', data: quiz.questions[currentQuizQuestionIndex] };
        }
        
        if (learningStage === 'results' && quizFeedback) {
            // Display summary first
            if (currentResultItemIndex === 0) {
                return { type: 'resultsSummary', data: quizFeedback };
            }
            // Then display individual feedback items
            const feedbackItemIndex = currentResultItemIndex - 1;
            if (feedbackItemIndex < quizFeedback.feedback_items.length) {
                return {
                    type: 'resultItem',
                    data: quizFeedback.feedback_items[feedbackItemIndex],
                    index: feedbackItemIndex,
                    total: quizFeedback.feedback_items.length
                };
            }
        }

        // If stage is 'complete' or none of the above match
        if (learningStage === 'complete') {
            return { type: 'complete' };
        }

        // Fallback error for unhandled states
        return { type: 'error', data: `Unhandled learning stage: ${learningStage}` };
    };

    // --- Interaction Handlers ---
    const handleNextClick = async () => {
        if (isSubmitting) return;

        if (learningStage === 'quiz' && currentQuizAnswer !== undefined) {
            // Store the answer before moving to next question
            setUserQuizAnswer(currentQuizQuestionIndex, parseInt(currentQuizAnswer));
        }

        if (learningStage === 'quiz' && currentQuizQuestionIndex === totalQuizQuestions - 1) {
            // On last question, submit the quiz
            setIsSubmitting(true);
            try {
                const answers: QuizUserAnswer[] = Object.entries(userQuizAnswers).map(([questionIndex, selectedOptionIndex]) => ({
                    question_index: parseInt(questionIndex),
                    selected_option_index: selectedOptionIndex
                }));

                const quizSubmission: QuizUserAnswers = {
                    quiz_title: quiz!.title,
                    user_answers: answers
                };

                const feedback = await api.submitQuiz(params.sessionId as string, quizSubmission);
                setQuizFeedback(feedback);
                setLearningStage('results');
            } catch (error) {
                console.error('Error submitting quiz:', error);
                setError('Failed to submit quiz. Please try again.');
            } finally {
                setIsSubmitting(false);
            }
        } else {
            // Normal navigation
            goToNextStep();
        }
    };

    // --- Determine Button States ---
    const isFirstStep = learningStage === 'lesson';
    const totalResultItems = quizFeedback ? (quizFeedback.feedback_items.length + 1) : 0; // +1 for summary
    const isLastStep = learningStage === 'complete' || (learningStage === 'results' && currentResultItemIndex >= totalResultItems - 1);

    const isNextDisabled = isSubmitting || loadingState === 'loading' || isLastStep ||
                          (learningStage === 'quiz' && currentQuizAnswer === undefined);

    const isPrevDisabled = isSubmitting || loadingState === 'loading' || isFirstStep;

    // Get the current view to render
    const currentView = getCurrentView();

    // --- Loading and Error States ---
    if (localLoading || (loadingState === 'loading' && (!lessonContent || !quiz))) {
        return (
            <div className="flex items-center justify-center w-full h-full">
                <LoadingSpinner message={loadingMessage || 'Loading session...'} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center w-full h-full p-4">
                <Alert variant="destructive" className="w-full max-w-lg">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Error Loading Learning Session</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                    <Button onClick={() => router.push('/')} variant="link" className="mt-2 -ml-4">Go back to start</Button>
                </Alert>
            </div>
        );
    }

    if (!hasInitialized || !lessonContent || !quiz) {
        return (
            <div className="flex items-center justify-center w-full h-full p-4">
                <Alert className="w-full max-w-lg">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Missing Data</AlertTitle>
                    <AlertDescription>Could not load all required learning materials.</AlertDescription>
                    <Button onClick={() => router.push('/')} variant="link" className="mt-2 -ml-4">Go back to start</Button>
                </Alert>
            </div>
        );
    }

    // --- Main Layout ---
    return (
        <div className="flex h-screen bg-muted/40">
            {/* Left Column - Phase 1 Styling (Empty) */}
            {/* Ensure it doesn't collapse and maintains width */}
            <div className="w-1/6 lg:w-1/5 flex-shrink-0 bg-gray-100 dark:bg-gray-900/50 border-r border-border/50">
                {/* Intentionally empty - Add padding or a subtle element if needed for visual separation */}
                <div className="p-4 h-full">
                    {/* Maybe a placeholder title or subtle graphic later */}
                </div>
            </div>

            {/* Right Column ("Whiteboard") */}
            <div className="flex-grow flex flex-col overflow-hidden">
                {/* Main Content Area - Crucial for "no scroll" */}
                {/* Use flex-grow to take available space, overflow-hidden is KEY */}
                {/* Setting explicit height `h-full` on children might be needed if Card doesn't fill */}
                <div className="flex-grow p-4 md:p-6 bg-background overflow-hidden relative">
                    {/* --- Conditional Rendering Logic based on currentView.type --- */}

                    {currentView.type === 'loading' && <LoadingSpinner message={currentView.message} />}
                    {currentView.type === 'error' && <DisplayError message={currentView.data} />}

                    {currentView.type === 'lesson' && <DisplayFullLesson lessonContent={currentView.data} />}

                    {currentView.type === 'practice' && <DisplayPracticeItems miniQuizzes={currentView.miniQuizzes} userSummaries={currentView.userSummaries} />}

                    {currentView.type === 'quizQuestion' && (
                        <QuizQuestion
                            question={currentView.data}
                            index={currentQuizQuestionIndex}
                            total={totalQuizQuestions}
                            selectedValue={currentQuizAnswer}
                            onAnswerChange={(value) => setCurrentQuizAnswer(value)}
                        />
                    )}

                    {currentView.type === 'resultsSummary' && <DisplayResultsSummary feedback={currentView.data} />}
                    {currentView.type === 'resultItem' && <DisplayResultFeedbackItem item={currentView.data} index={currentView.index} total={currentView.total} />}

                    {currentView.type === 'complete' && (
                        <Card className="h-full flex flex-col items-center justify-center">
                            <CardHeader><CardTitle>Lesson Complete!</CardTitle></CardHeader>
                            <CardContent><CardDescription>You have finished this learning session.</CardDescription></CardContent>
                        </Card>
                    )}
                </div>

                {/* Fixed Footer Area (For Navigation in Phase 4) */}
                <div className="p-3 md:p-4 border-t bg-card flex justify-between items-center flex-shrink-0"> {/* flex-shrink-0 prevents footer from shrinking */}
                    <Button variant="outline" onClick={goToPreviousStep} disabled={isPrevDisabled}>Previous</Button>
                    <Button onClick={handleNextClick} disabled={isNextDisabled}>
                        {isSubmitting ? 'Submitting...' : (learningStage === 'quiz' && currentQuizQuestionIndex === totalQuizQuestions - 1 ? 'Submit Quiz' : 'Next')}
                    </Button>
                </div>
            </div>
        </div>
    );
} 