'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { SessionState, useSessionStore } from '@/store/sessionStore';
import { shallow } from 'zustand/shallow';
import {
    QuizQuestion as QuizQuestionType,
    QuizFeedbackItem,
    LoadingState,
    InteractionContentType,
    UserModelState,
    // LessonContent type might not be needed if DisplayTextContent handles 'any'
} from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
// Progress component removed as it's no longer used

// --- QuizQuestion Component --- 
interface QuizQuestionProps {
    question: QuizQuestionType;
    // Index is still needed for mapping options and creating unique IDs
    index: number;
    onAnswerChange: (value: string) => void;
    selectedValue: string | undefined;
}

const QuizQuestion = ({
    question,
    index,
    onAnswerChange,
    selectedValue
}: QuizQuestionProps) => (
    <Card className="h-full flex flex-col">
        <CardHeader>
            <CardDescription>Question ({question.difficulty})</CardDescription>
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
                        {/* Using question.index might be wrong if it doesn't exist, stick to optionIndex or a unique question ID if available */}
                        <RadioGroupItem value={optionIndex.toString()} id={`q${index}-opt${optionIndex}`} />
                        <Label htmlFor={`q${index}-opt${optionIndex}`} className="cursor-pointer flex-1">{option}</Label>
                    </div>
                ))}
            </RadioGroup>
        </CardContent>
    </Card>
);

// --- DisplayResultFeedbackItem --- 
const DisplayResultFeedbackItem = ({ item }: { item: QuizFeedbackItem }) => (
    <Card className="h-full flex flex-col">
        <CardHeader>
            <CardDescription>Detailed Feedback for Question {item.question_index + 1}</CardDescription>
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

// --- DisplayError Component --- 
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

// --- DisplayTextContent Component --- 
const DisplayTextContent = ({ content }: { content: any }) => {
    let title: string | undefined = undefined;
    let text: string = "";

    if (typeof content === 'string') {
        text = content;
    } else if (content && typeof content === 'object') {
        // Check for common text properties, adapt if backend uses different keys
        if (typeof content.text === 'string') text = content.text;
        else if (typeof content.explanation === 'string') text = content.explanation; // Example fallback
        else if (typeof content.message === 'string') text = content.message; // Another fallback
        
        if (typeof content.title === 'string') title = content.title;

        // If no text found after checks
        if (!text && Object.keys(content).length > 0) {
             console.warn("DisplayTextContent received object without known text field:", content);
             // Attempt to render a string representation if no text found
             try { 
                text = JSON.stringify(content, null, 2);
                title = title || "Raw Content"; // Provide a title if none existed
             } catch (e) { 
                console.error("Failed to stringify content:", e);
                text = "[Unrenderable Object]";
                title = title || "Error";
             }
        }
    } 
    
    // If content is completely empty or unrenderable
    if (!text && (!content || (typeof content === 'object' && Object.keys(content).length === 0))) {
        console.warn("Unexpected empty/invalid content for DisplayTextContent:", content);
        return <DisplayError message="Received empty or invalid content."/>;
    }

    return (
        <Card className="h-full flex flex-col">
            {title && (
                 <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
            )}
            <CardContent className="prose dark:prose-invert max-w-none flex-grow overflow-y-auto">
                {/* Use pre-wrap for JSON string representation */}
                {title === "Raw Content" ? <pre className="whitespace-pre-wrap break-words">{text}</pre> : <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>}
            </CardContent>
        </Card>
    );
};

export default function LearnPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const sessionId = params.sessionId as string | null;

    // --- Individual state selectors ---
    const currentInteractionContent = useSessionStore((state) => state.currentInteractionContent);
    const currentContentType = useSessionStore((state) => state.currentContentType);
    const currentTopic = useSessionStore((state) => state.userModelState?.current_topic ?? null);
    const sessionSummary = useSessionStore((state) => state.userModelState?.session_summary ?? '');
    const currentQuizQuestion = useSessionStore((state) => state.currentQuizQuestion);
    const isLessonComplete = useSessionStore((state) => state.isLessonComplete);
    const loadingState = useSessionStore((state) => state.loadingState);
    const error = useSessionStore((state) => state.error);
    const loadingMessage = useSessionStore((state) => state.loadingMessage);
    const sendInteraction = useSessionStore((state) => state.sendInteraction);
    const setError = useSessionStore((state) => state.setError);

    const [selectedQuizAnswerIndex, setSelectedQuizAnswerIndex] = useState<number | undefined>(undefined);
    const [localLoading, setLocalLoading] = useState(true);
    const [hasInitialized, setHasInitialized] = useState(false);
    const isFetchingRef = useRef(false);

    // Debug logs for state tracking
    console.log('LearnPage Render - Loading:', loadingState, 'Error:', error, 'Initialized:', hasInitialized);
    console.log('LearnPage Render - ContentType:', currentContentType);
    console.log('LearnPage Render - Content:', currentInteractionContent);
    console.log('LearnPage Render - QuizQuestion:', currentQuizQuestion);

    // --- Initial Interaction Effect ---
    useEffect(() => {
        // Only run if we have a session ID and haven't fetched/initialized yet
        if (sessionId && !hasInitialized && !isFetchingRef.current) {
            isFetchingRef.current = true; // Mark as fetching immediately
            setLocalLoading(true);
            console.log("LearnPage: Sending initial 'start' interaction...");

            sendInteraction('start')
                .then(() => {
                    setHasInitialized(true); // Mark as initialized *after* success
                    console.log("LearnPage: Initial interaction successful.");
                })
                .catch((err: any) => {
                    console.error("LearnPage: Initial interaction failed.", err);
                    setError(err.message || "Failed to start session");
                })
                .finally(() => {
                    isFetchingRef.current = false; // Allow fetching again if needed (e.g., on error/retry)
                    setLocalLoading(false);
                });
        } else if (hasInitialized) {
            setLocalLoading(false); // If already initialized, ensure loading is false
        }
    }, [sessionId, hasInitialized]); // Keep dependencies minimal, sendInteraction and setError are stable

    // --- Effect to reset local answer state when content type changes ---
    useEffect(() => {
        if (currentContentType !== 'quiz_question' && currentContentType !== 'question') {
            setSelectedQuizAnswerIndex(undefined);
        }
    }, [currentContentType]);


    // --- Interaction Handlers ---
    const handleNext = () => {
        // Use the action reference directly from the store hook
        if (loadingState === 'interacting' || isLessonComplete) return;

        if (currentContentType === 'quiz_question' || currentContentType === 'question') {
            if (selectedQuizAnswerIndex === undefined) {
                toast({
                    title: "Please select an answer",
                    variant: "destructive",
                });
                return;
            }
            sendInteraction('answer', { answer_index: selectedQuizAnswerIndex });
        } else {
            sendInteraction('next');
        }
    };

    // --- Button States ---
    const isPrevDisabled = true; // Previous interaction not implemented
    const isNextDisabled = loadingState === 'interacting' || isLessonComplete ||
        ((currentContentType === 'quiz_question' || currentContentType === 'question') && selectedQuizAnswerIndex === undefined);

    // --- Loading and Error States ---
    if (localLoading || (loadingState === 'loading' && !hasInitialized)) {
        return (
            <div className="flex h-screen items-center justify-center">
                <LoadingSpinner message={loadingMessage || 'Initiating lesson...'} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center p-6">
                <DisplayError message={error} />
            </div>
        );
    }

    // Show error if initialized but no content and not loading/interacting
    if (hasInitialized && !currentInteractionContent && loadingState !== 'loading' && loadingState !== 'interacting' && !error) {
        return (
            <div className="flex h-screen items-center justify-center">
                <DisplayError message="No content received from the tutor." />
            </div>
        );
    }

    // Helper to check if content is a valid QuizFeedbackItem
    const isQuizFeedbackItem = (content: any): content is QuizFeedbackItem => {
        return !!content && typeof content === 'object' && typeof content.question_index === 'number' && typeof content.is_correct === 'boolean';
    }

    // --- Main Layout ---
    return (
        <div className="flex h-screen bg-muted/40">
            {/* Left Column (Stage Display & User Model - Simplified) */}
            <div className="w-1/6 lg:w-1/5 flex-shrink-0 bg-gray-100 dark:bg-gray-900/50 border-r border-border/50 hidden md:block">
                <div className="p-4 h-full overflow-y-auto">
                    {/* Current Topic */}
                    {currentTopic && (
                         <div className="mb-4">
                            <p className="text-sm font-medium text-muted-foreground mb-1">Current Topic</p>
                            <p className="text-sm font-semibold text-primary">{currentTopic}</p>
                        </div>
                    )}

                    {/* Simplified Stage Indicator */}
                    <div className="mb-4">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Lesson Flow</p>
                        <div className="space-y-1 text-sm">
                            {/* Ensure content type comparisons are valid */}
                            <p className={(currentContentType === 'text') ? 'font-semibold text-primary' : 'text-muted-foreground'}>Explanation</p>
                            <p className={currentContentType === 'quiz_question' ? 'font-semibold text-primary' : 'text-muted-foreground'}>Quiz Question</p>
                            <p className={(currentContentType === 'quiz_feedback_item' || currentContentType === 'feedback') ? 'font-semibold text-primary' : 'text-muted-foreground'}>Feedback</p>
                            <p className={isLessonComplete ? 'font-semibold text-primary' : 'text-muted-foreground'}>Complete</p>
                        </div>
                     </div>

                     {/* Session Summary (Optional) */} 
                     {sessionSummary && sessionSummary !== "Session initializing." && sessionSummary !== "Session reset." && (
                        <div className="mt-4 border-t pt-4">
                            <p className="text-sm font-medium text-muted-foreground mb-1">Session Summary</p>
                            <p className="text-xs text-muted-foreground">{sessionSummary || 'N/A'}</p>
                        </div>
                     )}
                </div>
            </div>

            {/* Right Column ("Whiteboard") */} 
            <div className="flex-grow flex flex-col overflow-hidden relative">
                {/* Main Content Area */} 
                <div className="flex-grow p-4 md:p-6 bg-background overflow-hidden">
                    <div className="h-full">
                        {/* Render based on currentContentType */} 
                        {currentContentType === 'text' && currentInteractionContent && (
                            <DisplayTextContent content={currentInteractionContent} />
                        )}
                        {currentContentType === 'explanation' && currentInteractionContent && (
                            <DisplayTextContent content={currentInteractionContent} />
                        )}

                        {(currentContentType === 'quiz_question' || currentContentType === 'question') && currentQuizQuestion && (
                            <QuizQuestion
                                question={currentQuizQuestion}
                                index={0} 
                                selectedValue={selectedQuizAnswerIndex?.toString()}
                                onAnswerChange={(value) => setSelectedQuizAnswerIndex(parseInt(value))}
                            />
                        )}

                        {currentContentType === 'quiz_feedback_item' && isQuizFeedbackItem(currentInteractionContent) && (
                           <DisplayResultFeedbackItem item={currentInteractionContent} />
                        )}

                        {currentContentType === 'feedback' && currentInteractionContent && isQuizFeedbackItem(currentInteractionContent.feedback) && (
                           <DisplayResultFeedbackItem item={currentInteractionContent.feedback} />
                        )}

                        {/* Display error content */}
                        {currentContentType === 'error' && currentInteractionContent && (
                            <DisplayError message={currentInteractionContent.message || 'An unknown error occurred'} />
                        )}

                        {/* Lesson Complete Message */} 
                        {isLessonComplete && (
                            <Card className="h-full flex flex-col items-center justify-center">
                                <CardHeader><CardTitle>Lesson Complete!</CardTitle></CardHeader>
                                <CardContent className="text-center">
                                    <CardDescription>You have finished this learning session.</CardDescription>
                                    {sessionId && (
                                        <Button className="mt-4" onClick={() => router.push(`/session/${sessionId}/analysis`)}>
                                            View Session Analysis
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                         {/* Display loading spinner during interaction */} 
                         {loadingState === 'interacting' && (
                            <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-10">
                                <LoadingSpinner message={loadingMessage || 'Processing...'} />
                            </div>
                         )}

                         {/* Fallback for unexpected content types */}
                         {hasInitialized && !['explanation', 'text', 'question', 'quiz_question', 'quiz_feedback_item', 'error', 'lesson_complete', 'feedback'].includes(currentContentType as string) && !isLessonComplete && !error && (
                            <DisplayError message={`Received unexpected or unhandled content type: ${currentContentType}`} />
                         )}
                    </div>
                </div>

                {/* Fixed Footer Area */} 
                <div className="p-3 md:p-4 border-t bg-card flex justify-between items-center flex-shrink-0">
                     {/* Previous button (disabled) */} 
                    <Button variant="outline" onClick={() => { /* No action */ }} disabled={isPrevDisabled}>
                        Previous
                    </Button>

                     {/* Next/Submit/Complete button */} 
                    {!isLessonComplete ? (
                        <Button onClick={handleNext} disabled={isNextDisabled}>
                            {loadingState === 'interacting'
                                ? 'Processing...'
                                : (currentContentType === 'quiz_question' || currentContentType === 'question')
                                    ? 'Submit Answer'
                                    : 'Next' // Default for text, feedback, etc.
                            }
                        </Button>
                    ) : (
                        // Button to start a new session when complete
                        <Button onClick={() => router.push('/')}>Start New Session</Button>
                    )}
                </div>
            </div>
        </div>
    );
} 