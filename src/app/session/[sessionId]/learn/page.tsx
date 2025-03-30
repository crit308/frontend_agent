'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/store/sessionStore';
import { shallow } from 'zustand/shallow';
import * as api from '@/lib/api';
import type {
    LessonContent,
    Quiz,
    QuizQuestion as QuizQuestionType,
    QuizFeedback,
    QuizFeedbackItem,
    QuizUserAnswer,
    QuizUserAnswers,
    LoadingState
} from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

// --- Keep QuizQuestion, DisplayResultsSummary, DisplayResultFeedbackItem, DisplayError ---
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

// --- NEW Simplified Lesson Display Component ---
const DisplaySimpleLesson = ({ lessonContent }: { lessonContent: LessonContent | null }) => {
    if (!lessonContent) return null;

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>{lessonContent.title}</CardTitle>
            </CardHeader>
            {/* Make CardContent scrollable */}
            <CardContent className="prose dark:prose-invert max-w-none flex-grow overflow-y-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{lessonContent.text}</ReactMarkdown>
            </CardContent>
        </Card>
    );
};

type CurrentViewData =
    | { type: 'loading'; message: string }
    | { type: 'error'; data: string }
    | { type: 'lesson'; data: LessonContent }
    | { type: 'quizQuestion'; data: QuizQuestionType; index: number; total: number }
    | { type: 'resultsSummary'; data: QuizFeedback }
    | { type: 'resultItem'; data: QuizFeedbackItem; index: number; total: number }
    | { type: 'complete' };

export default function LearnPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const sessionId = params.sessionId as string;

    // Use shallow comparison for objects from the store
    const lessonContent = useSessionStore(state => state.lessonContent, shallow);
    const quiz = useSessionStore(state => state.quiz, shallow);
    const quizFeedback = useSessionStore(state => state.quizFeedback, shallow);
    const userQuizAnswers = useSessionStore(state => state.userQuizAnswers, shallow);

    // --- SIMPLIFIED State & Actions ---
    const learningStage = useSessionStore(state => state.learningStage); // Now: 'lesson', 'quiz', 'results', 'complete'
    const currentQuizQuestionIndex = useSessionStore(state => state.currentQuizQuestionIndex);
    const currentResultItemIndex = useSessionStore(state => state.currentResultItemIndex);
    const totalQuizQuestions = useSessionStore(state => state.totalQuizQuestions);
    const loadingState = useSessionStore(state => state.loadingState);
    const error = useSessionStore(state => state.error);
    const loadingMessage = useSessionStore(state => state.loadingMessage);
    const isSubmittingQuiz = useSessionStore(state => state.isSubmittingQuiz);

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

    // --- Data Fetching Effect ---
    useEffect(() => {
        if (!sessionId) {
            setError('No session ID provided');
            return;
        }
        if (hasInitialized) return;
        if (isFetchingRef.current) return;

        const storeState = useSessionStore.getState();
        if (storeState.lessonContent) {
            console.log("LearnPage: Data found in store, initializing.");
            setHasInitialized(true);
            setLocalLoading(false);
            if (storeState.quiz && storeState.totalQuizQuestions === 0) {
                useSessionStore.setState({ totalQuizQuestions: storeState.quiz.questions.length });
            }
            return;
        }

        const fetchLearnData = async () => {
            isFetchingRef.current = true;
            setLocalLoading(true);
            setLoading('loading');
            setError(null);
            try {
                const [lessonData, quizData] = await Promise.all([
                    api.getLessonContent(sessionId),
                    api.getQuiz(sessionId)
                ]);

                if (!lessonData) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    const retryLessonData = await api.getLessonContent(sessionId);
                    if (!retryLessonData) {
                        throw new Error(`Failed to fetch lesson content after retry.`);
                    }
                    setLessonContent(retryLessonData);
                } else {
                    setLessonContent(lessonData);
                }

                setQuiz(quizData);
                setLoading('success');
                setHasInitialized(true);
            } catch (err: any) {
                const errorMessage = err.response?.data?.detail || err.message || 'Failed to load learning materials.';
                setError(errorMessage);
                setLoading('error');
                setHasInitialized(false);
            } finally {
                setLocalLoading(false);
                isFetchingRef.current = false;
            }
        };
        fetchLearnData();
    }, [sessionId, hasInitialized, setLessonContent, setQuiz, setLoading, setError]);

    // --- Effect to load stored answer ---
    useEffect(() => {
        if (learningStage === 'quiz' && userQuizAnswers && typeof currentQuizQuestionIndex === 'number') {
            const answer = userQuizAnswers[currentQuizQuestionIndex];
            if (answer) {
                setCurrentQuizAnswer(answer.selected_option_index.toString());
            }
        }
    }, [currentQuizQuestionIndex, learningStage, userQuizAnswers]);

    // --- Interaction Handlers ---
    const handleNextClick = async () => {
        if (isSubmittingQuiz || loadingState === 'loading') return;

        if (learningStage === 'quiz') {
            if (currentQuizAnswer === undefined) {
                toast({
                    title: "Please select an answer",
                    description: "You must select an answer before proceeding.",
                    variant: "destructive",
                });
                return;
            }

            if (currentQuizQuestionIndex === totalQuizQuestions - 1) {
                setIsSubmittingQuiz(true);
                try {
                    const answers: QuizUserAnswer[] = Object.entries(userQuizAnswers || {}).map(([index, answer]) => ({
                        question_index: parseInt(index),
                        selected_option_index: answer.selected_option_index,
                    }));

                    const quizSubmission: QuizUserAnswers = {
                        quiz_title: quiz?.title || '',
                        user_answers: answers,
                    };

                    const feedback = await api.submitQuiz(sessionId, quizSubmission);
                    setQuizFeedback(feedback);
                    goToNextStep();
                } catch (err: any) {
                    const errorMessage = err.response?.data?.detail || err.message || 'Failed to submit quiz.';
                    setError(errorMessage);
                    toast({
                        title: "Error",
                        description: errorMessage,
                        variant: "destructive",
                    });
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

    // --- Button States ---
    const isFirstRenderedStep = learningStage === 'lesson';
    const isLastRenderedStep = learningStage === 'complete';

    const isNextDisabled = isSubmittingQuiz || loadingState === 'loading' || learningStage === 'complete' ||
        (learningStage === 'quiz' && currentQuizAnswer === undefined);

    const isPrevDisabled = isSubmittingQuiz || loadingState === 'loading' || isFirstRenderedStep;

    // --- Loading and Error States ---
    if (loadingState === 'loading' && !hasInitialized) {
        return (
            <div className="flex h-screen items-center justify-center">
                <LoadingSpinner message={loadingMessage || 'Loading...'} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center">
                <DisplayError message={error} />
            </div>
        );
    }

    if (!lessonContent && !localLoading && !error) {
        return (
            <div className="flex h-screen items-center justify-center">
                <DisplayError message="Lesson content not available." />
            </div>
        );
    }

    // --- Main Layout ---
    return (
        <div className="flex h-screen bg-muted/40">
            {/* Left Column (Stage Display) */}
            <div className="w-1/6 lg:w-1/5 flex-shrink-0 bg-gray-100 dark:bg-gray-900/50 border-r border-border/50 hidden md:block">
                <div className="p-4 h-full">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Stage</p>
                    <div className="space-y-1 text-sm">
                        <p className={learningStage === 'lesson' ? 'font-semibold text-primary' : 'text-muted-foreground'}>1. Lesson</p>
                        {quiz && quiz.questions.length > 0 && <p className={learningStage === 'quiz' ? 'font-semibold text-primary' : 'text-muted-foreground'}>2. Quiz</p>}
                        {quizFeedback && <p className={learningStage === 'results' ? 'font-semibold text-primary' : 'text-muted-foreground'}>{quiz ? '3.' : '2.'} Results</p>}
                        <p className={learningStage === 'complete' ? 'font-semibold text-primary' : 'text-muted-foreground'}>{quizFeedback ? (quiz ? '4.' : '3.') : (quiz ? '3.' : '2.')} Complete</p>
                    </div>
                    {/* Progress bars */}
                    {learningStage === 'quiz' && totalQuizQuestions > 0 && (
                        <div className="mt-4">
                            <Label className="text-xs text-muted-foreground">Quiz Progress</Label>
                            <Progress value={((currentQuizQuestionIndex + 1) / totalQuizQuestions) * 100} className="h-2 mt-1" />
                        </div>
                    )}
                    {learningStage === 'results' && quizFeedback && (
                        <div className="mt-4">
                            <Label className="text-xs text-muted-foreground">Results Progress</Label>
                            <Progress value={((currentResultItemIndex + 1) / (quizFeedback.feedback_items.length + 1)) * 100} className="h-2 mt-1" />
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column ("Whiteboard") */}
            <div className="flex-grow flex flex-col overflow-hidden">
                {/* Main Content Area */}
                <div className="flex-grow p-4 md:p-6 bg-background overflow-hidden relative">
                    <div className="h-full">
                        {/* --- RENDER SIMPLIFIED LESSON --- */}
                        {learningStage === 'lesson' && lessonContent && (
                            <DisplaySimpleLesson lessonContent={lessonContent} />
                        )}

                        {/* --- Quiz and Results rendering --- */}
                        {learningStage === 'quiz' && quiz && quiz.questions && quiz.questions[currentQuizQuestionIndex] && (
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
                                <CardContent className="text-center">
                                    <CardDescription>You have finished this learning session.</CardDescription>
                                    <Button className="mt-4" onClick={() => router.push(`/session/${sessionId}/analysis`)}>
                                        View Session Analysis
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Handle missing data cases */}
                        {learningStage === 'lesson' && !lessonContent && !localLoading && (
                            <DisplayError message="Lesson content not available." />
                        )}
                        {learningStage === 'quiz' && (!quiz?.questions || !quiz.questions[currentQuizQuestionIndex]) && (
                            <DisplayError message="Quiz question not available." />
                        )}
                        {learningStage === 'results' && !quizFeedback && (
                            <DisplayError message="Quiz results not available." />
                        )}

                        {/* Loading indicators */}
                        {localLoading && <LoadingSpinner message={loadingMessage || 'Loading...'}/>}
                        {isSubmittingQuiz && <LoadingSpinner message="Submitting quiz..." />}
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