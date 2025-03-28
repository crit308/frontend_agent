'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSessionStore } from '@/store/sessionStore';
import * as api from '@/lib/api';
import { Quiz, QuizUserAnswer, QuizUserAnswers } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : null;

  const { quiz, setQuiz, quizFeedback, setQuizFeedback, loadingState, setLoading, error, setError } = useSessionStore(state => ({
    quiz: state.quiz,
    setQuiz: state.setQuiz,
    quizFeedback: state.quizFeedback,
    setQuizFeedback: state.setQuizFeedback,
    loadingState: state.loadingState,
    setLoading: state.setLoading,
    error: state.error,
    setError: state.setError,
  }));

  const [localLoading, setLocalLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: number }>({});
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid session ID.');
      setLocalLoading(false);
      return;
    }

    const fetchQuiz = async () => {
      setLocalLoading(true);
      setLoading('loading', 'Fetching quiz...');
      setError(null);
      try {
        const data = await api.getQuiz(sessionId);
        if (!data || !data.questions || data.questions.length === 0) {
          setLoading('loading', 'Quiz is still generating, please wait...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          const retryData = await api.getQuiz(sessionId);
          if (!retryData || !retryData.questions || retryData.questions.length === 0) {
            throw new Error("Quiz generation timed out or failed.");
          }
          setQuiz(retryData);
        } else {
          setQuiz(data);
        }
        setLoading('success');
      } catch (err: any) {
        console.error("Failed to fetch quiz:", err);
        const errorMessage = err.response?.data?.detail || err.message || 'Failed to load quiz.';
        setError(errorMessage);
        setLoading('error', errorMessage);
      } finally {
        setLocalLoading(false);
      }
    };

    fetchQuiz();
  }, [sessionId, setQuiz, setLoading, setError]);

  const handleAnswerChange = (questionIndex: number, selectedOptionIndex: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: parseInt(selectedOptionIndex, 10),
    }));
  };

  const handleSubmit = async () => {
    if (!quiz || !sessionId) return;

    const allAnswered = quiz.questions.every((_, index) => userAnswers[index] !== undefined);
    if (!allAnswered) {
      toast({ title: "Incomplete Quiz", description: "Please answer all questions.", variant: "destructive" });
      return;
    }

    setLoading('loading', 'Submitting answers...');
    setError(null);

    const formattedAnswers: QuizUserAnswer[] = Object.entries(userAnswers).map(([qIndex, oIndex]) => ({
      question_index: parseInt(qIndex, 10),
      selected_option_index: oIndex,
    }));

    const totalTimeTaken = Math.round((Date.now() - startTime) / 1000);

    const submissionData: QuizUserAnswers = {
      quiz_title: quiz.title,
      user_answers: formattedAnswers,
      total_time_taken_seconds: totalTimeTaken,
    };

    try {
      const feedback = await api.submitQuiz(sessionId, submissionData);
      setQuizFeedback(feedback);
      setLoading('success');
      router.push(`/session/${sessionId}/results`);
    } catch (err: any) {
      console.error("Failed to submit quiz:", err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to submit quiz.';
      setError(errorMessage);
      setLoading('error', errorMessage);
      toast({ title: "Submission Failed", description: errorMessage, variant: "destructive" });
    }
  };

  if (localLoading || loadingState === 'loading' && !quiz) {
    return <LoadingSpinner message={useSessionStore.getState().loadingMessage || 'Loading quiz...'} />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Loading Quiz</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={() => router.push('/')} variant="link" className="mt-2">Go back to start</Button>
      </Alert>
    );
  }

  if (!quiz) {
    return (
      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>No Quiz Available</AlertTitle>
        <AlertDescription>The quiz could not be loaded.</AlertDescription>
        <Button onClick={() => router.push('/')} variant="link" className="mt-2">Go back to start</Button>
      </Alert>
    );
  }

  const allQuestionsAnswered = quiz.questions.length === Object.keys(userAnswers).length;

  return (
    <div className="container mx-auto py-8">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{quiz.title}</CardTitle>
          <CardDescription>{quiz.description}</CardDescription>
          <div className="text-sm text-muted-foreground pt-2">
            <span>{quiz.questions.length} Questions</span> |
            <span> Passing Score: {quiz.passing_score}/{quiz.total_points}</span> |
            <span> Est. Time: {quiz.estimated_completion_time_minutes} min</span>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        {quiz.questions.map((q, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-lg">Question {index + 1}</CardTitle>
              <CardDescription>{q.question} <span className="text-xs text-muted-foreground ml-2">({q.difficulty})</span></CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={userAnswers[index]?.toString()}
                onValueChange={(value) => handleAnswerChange(index, value)}
              >
                {q.options.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center space-x-2 my-2 p-2 border rounded hover:bg-accent">
                    <RadioGroupItem value={optIndex.toString()} id={`q${index}-opt${optIndex}`} />
                    <Label htmlFor={`q${index}-opt${optIndex}`} className="cursor-pointer flex-1">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Button
          onClick={handleSubmit}
          disabled={!allQuestionsAnswered || loadingState === 'loading'}
          size="lg"
        >
          {loadingState === 'loading' ? 'Submitting...' : 'Submit Quiz'}
        </Button>
        {loadingState === 'error' && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
    </div>
  );
} 