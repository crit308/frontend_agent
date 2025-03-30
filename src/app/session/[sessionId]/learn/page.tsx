'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast"; // For feedback
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown'; // Needed for rendering markdown content
import remarkGfm from 'remark-gfm'; // Needed for markdown tables, etc.
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/store/sessionStore';
import { shallow } from 'zustand/shallow'; // Add shallow import
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

const DisplayFullLesson = ({ lessonContent }: { lessonContent: LessonContent }) => {
    if (!lessonContent) return null;

    return (
        <div className="h-full overflow-y-auto p-1 space-y-6">
            {/* Lesson Intro */}
            <Card className="mb-6">
                <CardHeader><CardTitle>{lessonContent.title}</CardTitle></CardHeader>
                <CardContent className="prose dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{lessonContent.introduction}</ReactMarkdown>
                </CardContent>
            </Card>

            {/* Sections */}
            {lessonContent.sections.map((section, index) => (
                <Card key={index} className="mb-6 border-l-4 border-primary/30">
                    <CardHeader><CardTitle>Section {index + 1}: {section.title}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {/* Section Intro */}
                        <div className="prose dark:prose-invert max-w-none text-sm text-muted-foreground pl-2 border-l-2">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.introduction}</ReactMarkdown>
                        </div>

                        {/* Explanations with embedded MiniQuiz and UserSummary */}
                        {section.explanations.map((explanation, expIndex) => (
                            <div key={expIndex} className="ml-4 border rounded p-4 mt-4 bg-background shadow-sm">
                                <p className="font-semibold text-lg mb-2">{explanation.topic}</p>
                                <div className="prose dark:prose-invert max-w-none text-sm mb-3">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation.explanation}</ReactMarkdown>
                                </div>
                                {explanation.examples && explanation.examples.length > 0 && (
                                    <div className="mt-2 mb-3">
                                        <p className="font-medium text-xs text-muted-foreground">Examples:</p>
                                        <ul className="list-disc list-inside text-xs ml-4">
                                            {explanation.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                                        </ul>
                                    </div>
                                )}
                                {/* Render MiniQuiz if it exists for this explanation */}
                                {explanation.mini_quiz?.map((mq, mqIndex) => (
                                    <MiniQuiz key={`mq-${expIndex}-${mqIndex}`} question={mq} />
                                ))}
                                {/* Render UserSummary prompt after explanation/mini-quiz */}
                                <UserSummary sectionTitle={section.title} topic={explanation.topic} />
                            </div>
                        ))}

                        {/* Section Summary */}
                        <div className="mt-6 pt-4 border-t">
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
};

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

    // --- Apply equality checks for non-primitive selectors ---
    const lessonContent = useSessionStore(state => state.lessonContent, shallow);
    const quiz = useSessionStore(state => state.quiz, shallow);
    const quizFeedback = useSessionStore(state => state.quizFeedback, shallow);
    const userQuizAnswers = useSessionStore(state => state.userQuizAnswers, shallow);
    
    // Primitive selectors don't need equality checks
    const learningStage = useSessionStore(state => state.learningStage);
    const currentQuizQuestionIndex = useSessionStore(state => state.currentQuizQuestionIndex);
    const currentResultItemIndex = useSessionStore(state => state.currentResultItemIndex);
    const totalQuizQuestions = useSessionStore(state => state.totalQuizQuestions);
    const loadingState = useSessionStore(state => state.loadingState);
    const error = useSessionStore(state => state.error);
    const loadingMessage = useSessionStore(state => state.loadingMessage);
    const isSubmittingQuiz = useSessionStore(state => state.isSubmittingQuiz);

    // Actions don't need equality checks as their references are stable
    const setLoading = useSessionStore(state => state.setLoading);
    const setError = useSessionStore(state => state.setError);
    const setLessonContent = useSessionStore(state => state.setLessonContent);
    const setQuiz = useSessionStore(state => state.setQuiz);
    const setQuizFeedback = useSessionStore(state => state.setQuizFeedback);
    const setUserQuizAnswer = useSessionStore(state => state.setUserQuizAnswer);
    const setIsSubmittingQuiz = useSessionStore(state => state.setIsSubmittingQuiz);
    const goToNextStep = useSessionStore(state => state.goToNextStep);
    const goToPreviousStep = useSessionStore(state => state.goToPreviousStep);

    const [localLoading, setLocalLoading] = useState(true);
    const [hasInitialized, setHasInitialized] = useState(false);
    const [currentQuizAnswer, setCurrentQuizAnswer] = useState<string | undefined>(undefined);
    const isFetchingRef = useRef(false);

    // --- Data Fetching Effect (Refined Guards) ---
    useEffect(() => {
        console.log(`LearnPage Effect Run: sessionId=${sessionId}, hasInitialized=${hasInitialized}, isFetching=${isFetchingRef.current}`);

        if (!sessionId) {
            setError('Invalid session ID.');
            setLocalLoading(false);
            setHasInitialized(false);
            return;
        }

        // GUARD 1: Already initialized? Stop.
        if (hasInitialized) {
            console.log("Effect Guard: Already initialized.");
            if (localLoading) setLocalLoading(false);
            return;
        }

        // GUARD 2: Already fetching? Stop.
        if (isFetchingRef.current) {
            console.log("Effect Guard: Already fetching.");
            return;
        }

        // GUARD 3: Data already exists in store? Initialize and stop.
        const storeState = useSessionStore.getState();
        if (storeState.lessonContent) {
            console.log("Effect Guard: Data found in store, initializing.");
            setHasInitialized(true);
            setLocalLoading(false);
            // Ensure totalQuizQuestions is set if quiz exists
            if (storeState.quiz && storeState.totalQuizQuestions === 0) {
                useSessionStore.setState({ totalQuizQuestions: storeState.quiz.questions.length });
            }
            return;
        }

        // --- Proceed with Fetching ---
        const fetchLearnData = async () => {
            console.log("Effect Action: Starting fetch...");
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
                    throw new Error(`Failed to fetch essential lesson content.`);
                }

                console.log("Effect Action: Fetch successful, setting state...");
                setLessonContent(lessonData);
                setQuiz(quizData);
                setLoading('success');
                setHasInitialized(true);
                console.log("Effect Action: State set, initialization complete.");

            } catch (err: any) {
                console.error("Failed to fetch learning data:", err);
                const errorMessage = err.response?.data?.detail || err.message || 'Failed to load learning materials.';
                setError(errorMessage);
                setLoading('error', errorMessage);
                setHasInitialized(false);
            } finally {
                console.log("Effect Action: Fetch finished (finally block).");
                setLocalLoading(false);
                isFetchingRef.current = false;
            }
        };

        fetchLearnData();
    }, [sessionId]);

    // --- Effect to load stored answer (Optimized) ---
    useEffect(() => {
        if (learningStage === 'quiz') {
            const currentAnswer = userQuizAnswers[currentQuizQuestionIndex]?.toString();
            // Only call setCurrentQuizAnswer if the value actually changes
            setCurrentQuizAnswer(prev => prev === currentAnswer ? prev : currentAnswer);
        } else {
            // Only call if it's not already undefined
            setCurrentQuizAnswer(prev => prev === undefined ? prev : undefined);
        }
    }, [currentQuizQuestionIndex, learningStage, userQuizAnswers]);

    // --- Interaction Handlers ---
    const handleNextClick = async () => {
        if (isSubmittingQuiz || loadingState === 'loading') return;

        // --- Quiz Submission Logic (Triggered on last question) ---
        if (learningStage === 'quiz') {
            if (currentQuizAnswer !== undefined) {
                setUserQuizAnswer(currentQuizQuestionIndex, parseInt(currentQuizAnswer));
            } else {
                toast({ title: "Please select an answer", variant: "destructive" });
                return;
            }

            if (currentQuizQuestionIndex === totalQuizQuestions - 1) {
                console.log("Submitting quiz...");
                setIsSubmittingQuiz(true);
                try {
                    if (!quiz) throw new Error("Quiz data is missing.");

                    const finalAnswerIndex = parseInt(currentQuizAnswer);
                    const finalAnswers = {
                        ...userQuizAnswers,
                        [currentQuizQuestionIndex]: finalAnswerIndex
                    };
                    const finalSubmissionAnswers: QuizUserAnswer[] = Object.entries(finalAnswers).map(([qIndex, ansIndex]) => ({
                        question_index: parseInt(qIndex),
                        selected_option_index: ansIndex
                    }));

                    const submission: QuizUserAnswers = { quiz_title: quiz.title, user_answers: finalSubmissionAnswers };
                    const feedback = await api.submitQuiz(sessionId!, submission);
                    setQuizFeedback(feedback);
                    console.log("Quiz submitted, feedback received.");
                } catch (error: any) {
                    setError(error.message || 'Failed to submit quiz');
                    toast({ title: "Failed to submit quiz", description: error.message, variant: "destructive" });
                } finally {
                    setIsSubmittingQuiz(false);
                }
                return;
            }
        }

        // --- Normal Stage/Index Navigation ---
        goToNextStep();
    };

    const handlePreviousClick = () => {
        if (isSubmittingQuiz || loadingState === 'loading') return;
        goToPreviousStep();
    };

    // --- Determine Button States ---
    const isFirstRenderedStep = learningStage === 'lesson';
    const isLastRenderedStep = learningStage === 'complete' ||
        (learningStage === 'results' && currentResultItemIndex >= (quizFeedback?.feedback_items?.length ?? 0));

    const isNextDisabled = isSubmittingQuiz || loadingState === 'loading' || learningStage === 'complete' ||
        (learningStage === 'quiz' && currentQuizAnswer === undefined);

    const isPrevDisabled = isSubmittingQuiz || loadingState === 'loading' || isFirstRenderedStep;

    // --- Loading and Error States ---
    if (loadingState === 'loading' && !hasInitialized) {
        return (
            <div className="flex h-screen items-center justify-center">
                <LoadingSpinner message={loadingMessage} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <Alert variant="destructive">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!lessonContent && !localLoading && !error) {
        return <div className="p-4">No lesson content available for this session.</div>;
    }

    // --- Main Layout ---
    return (
        <div className="flex h-screen bg-muted/40">
            {/* Left Column (Optional) */}
            <div className="w-1/6 lg:w-1/5 flex-shrink-0 bg-gray-100 dark:bg-gray-900/50 border-r border-border/50">
                <div className="p-4 h-full">
                    <p className="text-sm font-medium text-muted-foreground">Stage</p>
                    <p className="text-lg font-semibold capitalize">{learningStage}</p>
                </div>
            </div>

            {/* Right Column ("Whiteboard") */}
            <div className="flex-grow flex flex-col overflow-hidden">
                {/* Main Content Area */}
                <div className="flex-grow p-4 md:p-6 bg-background overflow-hidden relative">
                    <div className="h-full">
                        {learningStage === 'lesson' && lessonContent && (
                            <DisplayFullLesson lessonContent={lessonContent} />
                        )}

                        {learningStage === 'quiz' && quiz?.questions[currentQuizQuestionIndex] && (
                            <QuizQuestion
                                question={quiz.questions[currentQuizQuestionIndex]}
                                index={currentQuizQuestionIndex}
                                total={totalQuizQuestions}
                                selectedValue={currentQuizAnswer}
                                onAnswerChange={(value) => setCurrentQuizAnswer(value)}
                            />
                        )}

                        {learningStage === 'results' && quizFeedback && (
                            currentResultItemIndex === 0
                                ? <DisplayResultsSummary feedback={quizFeedback} />
                                : <DisplayResultFeedbackItem
                                    item={quizFeedback.feedback_items[currentResultItemIndex - 1]}
                                    index={currentResultItemIndex - 1}
                                    total={quizFeedback.feedback_items.length}
                                />
                        )}

                        {learningStage === 'complete' && (
                            <Card className="h-full flex flex-col items-center justify-center">
                                <CardHeader><CardTitle>Lesson Complete!</CardTitle></CardHeader>
                                <CardContent>
                                    <CardDescription>You have finished this learning session.</CardDescription>
                                    <Button className="mt-4" onClick={() => router.push(`/session/${sessionId}/analysis`)}>
                                        View Session Analysis
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Handle cases where data might be missing */}
                        {learningStage === 'quiz' && !quiz?.questions[currentQuizQuestionIndex] && (
                            <DisplayError message="Quiz question not available." />
                        )}
                        {learningStage === 'results' && !quizFeedback && (
                            <DisplayError message="Quiz results not available." />
                        )}
                    </div>
                </div>

                {/* Fixed Footer Area */}
                <div className="p-3 md:p-4 border-t bg-card flex justify-between items-center flex-shrink-0">
                    <Button variant="outline" onClick={handlePreviousClick} disabled={isPrevDisabled}>
                        Previous
                    </Button>
                    {learningStage !== 'complete' && (
                        <Button onClick={handleNextClick} disabled={isNextDisabled}>
                            {isSubmittingQuiz
                                ? 'Submitting...'
                                : (learningStage === 'quiz' && currentQuizQuestionIndex === totalQuizQuestions - 1)
                                    ? 'Submit Quiz'
                                    : 'Next'
                            }
                        </Button>
                    )}
                    {learningStage === 'complete' && (
                        <Button onClick={() => router.push('/')}>Start New Session</Button>
                    )}
                </div>
            </div>
        </div>
    );
} 