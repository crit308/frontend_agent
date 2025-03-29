'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast"; // For feedback
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown'; // Needed for rendering markdown content
import remarkGfm from 'remark-gfm'; // Needed for markdown tables, etc.
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/store/sessionStore';
import * as api from '@/lib/api';
import type { LessonContent, Quiz, SectionContent, ExplanationContent, QuizQuestion as QuizQuestionType, QuizFeedback, QuizFeedbackItem } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner'; // Reuse LoadingSpinner
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Useful for styling chunks
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import MiniQuiz from '@/components/MiniQuiz'; // Reuse MiniQuiz component
import UserSummary from '@/components/UserSummary'; // Reuse UserSummary component
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // For quiz questions
import { Label } from "@/components/ui/label"; // For quiz questions

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

export default function LearnPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const sessionId = typeof params.sessionId === 'string' ? params.sessionId : null;

    // --- Select state slices individually from Zustand ---
    const lessonContent = useSessionStore(state => state.lessonContent);
    const quiz = useSessionStore(state => state.quiz);
    const quizFeedback = useSessionStore(state => state.quizFeedback);
    const loadingState = useSessionStore(state => state.loadingState);
    const error = useSessionStore(state => state.error);
    const loadingMessage = useSessionStore(state => state.loadingMessage);
    const learningStage = useSessionStore(state => state.learningStage);
    const currentLessonSectionIndex = useSessionStore(state => state.currentLessonSectionIndex);
    const currentLessonItemIndex = useSessionStore(state => state.currentLessonItemIndex);
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

    const getCurrentStepContent = (): StepContent => {
        if (loadingState === 'error') {
            return { type: 'error', data: error || 'An unknown error occurred' };
        }

        if (learningStage === 'intro') {
            if (lessonContent) {
                return { type: 'lessonIntro', data: lessonContent };
            } else {
                return { type: 'error', data: 'Lesson content not loaded for intro stage.' };
            }
        }

        if (learningStage === 'lesson' && lessonContent && currentLessonSectionIndex >= 0) {
            const section = lessonContent.sections[currentLessonSectionIndex];
            if (!section) return { type: 'error', data: `Invalid section index: ${currentLessonSectionIndex}` };

            let cumulativeIndex = 0;

            // 1. Section Intro
            if (currentLessonItemIndex === cumulativeIndex) {
                return { type: 'sectionIntro', data: section };
            }
            cumulativeIndex++;

            // 2. Explanations, MiniQuizzes, UserSummaries
            for (const explanation of section.explanations) {
                // Explanation itself
                if (currentLessonItemIndex === cumulativeIndex) {
                    return { type: 'explanation', data: explanation, sectionTitle: section.title };
                }
                cumulativeIndex++;

                // MiniQuiz (if exists)
                if (explanation.mini_quiz && explanation.mini_quiz.length > 0) {
                    // Display only the first mini quiz question for now per explanation step
                    if (currentLessonItemIndex === cumulativeIndex) {
                        return { type: 'miniQuiz', data: explanation.mini_quiz[0] };
                    }
                    cumulativeIndex++;
                }

                // UserSummary Prompt
                if (currentLessonItemIndex === cumulativeIndex) {
                    return { type: 'userSummary', data: { sectionTitle: section.title, topic: explanation.topic } };
                }
                cumulativeIndex++;
            }

            // 3. Section Summary
            if (currentLessonItemIndex === cumulativeIndex) {
                return { type: 'sectionSummary', data: section };
            }

            // If index is out of bounds for the section items
            return { type: 'error', data: `Invalid item index ${currentLessonItemIndex} within section ${currentLessonSectionIndex}` };
        }

        if (learningStage === 'conclusion') {
            if (lessonContent) {
                return { type: 'lessonConclusion', data: lessonContent };
            } else {
                return { type: 'error', data: 'Lesson content not loaded for conclusion stage.' };
            }
        }

        if (learningStage === 'quiz' && quiz && quiz.questions.length > currentQuizQuestionIndex) {
            return {
                type: 'quizQuestion',
                data: quiz.questions[currentQuizQuestionIndex]
            };
        }

        if (learningStage === 'results' && quizFeedback) {
            if (currentResultItemIndex === 0) {
                return { type: 'resultsSummary', data: quizFeedback };
            }
            // Check index bounds for feedback items
            if (currentResultItemIndex > 0 && currentResultItemIndex <= quizFeedback.feedback_items.length) {
                return {
                    type: 'resultItem',
                    data: quizFeedback.feedback_items[currentResultItemIndex - 1],
                    index: currentResultItemIndex,
                    total: quizFeedback.feedback_items.length
                };
            } else {
                return { type: 'error', data: `Invalid result item index: ${currentResultItemIndex}` };
            }
        }

        // If stage is 'complete' or none of the above match
        if (learningStage === 'complete') {
            return { type: 'error', data: 'Lesson Complete!' }; // Placeholder
        }

        // Fallback error for unhandled states
        return { type: 'error', data: `Unhandled state: Stage=${learningStage}, Section=${currentLessonSectionIndex}, Item=${currentLessonItemIndex}` };
    };

    // --- Interaction Handlers ---
    const handleNextClick = async () => {
        if (isSubmitting) return;

        if (learningStage === 'quiz' && currentQuizAnswer !== undefined) {
             setUserQuizAnswer(currentQuizQuestionIndex, parseInt(currentQuizAnswer, 10));
        }

        if (learningStage === 'quiz' && currentQuizQuestionIndex === totalQuizQuestions - 1) {
            if (!sessionId || !quiz) return;

            const allAnswered = quiz.questions.every((_, index) => userQuizAnswers[index] !== undefined || (index === currentQuizQuestionIndex && currentQuizAnswer !== undefined));
             if (!allAnswered) {
                toast({ title: "Incomplete Quiz", description: "Please ensure all questions are answered before submitting.", variant: "destructive" });
                 return;
             }

            setIsSubmitting(true);
            setLoading('loading', 'Submitting answers...');

             const finalAnswers = {...userQuizAnswers};
             if (currentQuizAnswer !== undefined) {
                 finalAnswers[currentQuizQuestionIndex] = parseInt(currentQuizAnswer, 10);
             }

            const submissionData = {
                quiz_title: quiz.title,
                user_answers: Object.entries(finalAnswers).map(([qIndex, oIndex]) => ({
                    question_index: parseInt(qIndex, 10),
                    selected_option_index: oIndex,
                })),
            };

            try {
                const feedback = await api.submitQuiz(sessionId, submissionData);
                setQuizFeedback(feedback);
                setLoading('success');
                useSessionStore.setState({ learningStage: 'results', currentResultItemIndex: 0 });
                toast({ title: "Quiz Submitted!", description: "Results are now available." });
            } catch (err: any) {
                console.error("Failed to submit quiz:", err);
                const errorMsg = err.response?.data?.detail || err.message || 'Failed to submit quiz.';
                setError(errorMsg);
                setLoading('error', errorMsg);
                toast({ title: "Submission Failed", description: errorMsg, variant: "destructive" });
            } finally {
                 setIsSubmitting(false);
            }
        } else {
            goToNextStep();
            setCurrentQuizAnswer(undefined);
        }
    };

    // --- Determine Button States ---
    const isFirstStep = learningStage === 'intro' && currentLessonItemIndex === 0;
    const isLastStep = learningStage === 'complete' || (learningStage === 'results' && currentResultItemIndex >= (quizFeedback?.feedback_items?.length ?? 0));

    const isNextDisabled = isSubmitting || loadingState === 'loading' || isLastStep ||
                          (learningStage === 'quiz' && currentQuizAnswer === undefined);

    const isPrevDisabled = isSubmitting || loadingState === 'loading' || isFirstStep;

    const currentStepContent = getCurrentStepContent();

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
                    {/* --- Conditional Rendering Logic --- */}
                    {/* --- ADD RENDERING FOR LESSON STEPS --- */}
                    {currentStepContent.type === 'lessonIntro' && <DisplayLessonIntro lessonContent={currentStepContent.data} />}
                    {currentStepContent.type === 'sectionIntro' && <DisplaySectionIntro section={currentStepContent.data} />}
                    {currentStepContent.type === 'explanation' && <DisplayExplanation explanation={currentStepContent.data} sectionTitle={currentStepContent.sectionTitle} />}
                    {currentStepContent.type === 'miniQuiz' && (
                        <Card className="h-full flex flex-col">
                            <CardContent className="flex-grow overflow-y-auto p-4">
                                <MiniQuiz question={currentStepContent.data} />
                            </CardContent>
                        </Card>
                    )}
                    {currentStepContent.type === 'userSummary' && (
                        <Card className="h-full flex flex-col">
                            <CardContent className="flex-grow overflow-y-auto p-4">
                                <UserSummary sectionTitle={currentStepContent.data.sectionTitle} topic={currentStepContent.data.topic} />
                            </CardContent>
                        </Card>
                    )}
                    {currentStepContent.type === 'sectionSummary' && <DisplaySectionSummary section={currentStepContent.data} />}
                    {currentStepContent.type === 'lessonConclusion' && <DisplayLessonConclusion lessonContent={currentStepContent.data} />}

                    {/* Existing Quiz/Results Rendering */}
                    {currentStepContent.type === 'quizQuestion' && (
                        <QuizQuestion
                            question={currentStepContent.data}
                            index={currentQuizQuestionIndex}
                            total={totalQuizQuestions}
                            selectedValue={currentQuizAnswer}
                            onAnswerChange={(value) => setCurrentQuizAnswer(value)}
                        />
                    )}
                    {currentStepContent.type === 'resultsSummary' && <DisplayResultsSummary feedback={currentStepContent.data} />}
                    {currentStepContent.type === 'resultItem' && <DisplayResultFeedbackItem item={currentStepContent.data} index={currentStepContent.index} total={currentStepContent.total} />}

                    {/* Error Display */}
                    {currentStepContent.type === 'error' && (
                        <Alert variant="destructive">
                            <Terminal className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{currentStepContent.data}</AlertDescription>
                        </Alert>
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