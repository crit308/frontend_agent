'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSessionStore } from '@/store/sessionStore';
import * as api from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Trophy, TrendingUp, BookOpen } from 'lucide-react';

// Create a custom Badge component since we don't have the shadcn/ui one
const Badge = ({ variant = "default", className = "", children }: { variant?: "default" | "destructive", className?: string, children: React.ReactNode }) => {
  const baseClasses = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors";
  const variantClasses = variant === "destructive" 
    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    : "bg-primary text-primary-foreground";
  
  return (
    <div className={`${baseClasses} ${variantClasses} ${className}`}>
      {children}
    </div>
  );
};

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : null;

  const { quizFeedback, loadingState, error, setLoading, setError, setSessionAnalysis } = useSessionStore(state => ({
    quizFeedback: state.quizFeedback,
    loadingState: state.loadingState,
    error: state.error,
    setLoading: state.setLoading,
    setError: state.setError,
    setSessionAnalysis: state.setSessionAnalysis,
  }));

  const handleTriggerAnalysis = async () => {
    if (!sessionId) return;
    setLoading('loading', 'Analyzing session...');
    setError(null);
    try {
      await api.triggerSessionAnalysis(sessionId);
      setLoading('loading', 'Analysis in progress...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      router.push(`/session/${sessionId}/analysis`);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to trigger session analysis.';
      setError(errorMessage);
      setLoading('error', errorMessage);
    }
  };

  if (loadingState === 'loading') {
    return <LoadingSpinner message="Loading results..." />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={() => router.push('/')} variant="link" className="mt-2">Go back to start</Button>
      </Alert>
    );
  }

  if (!quizFeedback) {
    return (
      <Alert>
        <AlertTitle>No Feedback Available</AlertTitle>
        <AlertDescription>Quiz feedback could not be loaded. Please try submitting the quiz again.</AlertDescription>
        <Button onClick={() => sessionId ? router.push(`/session/${sessionId}/quiz`) : router.push('/')} variant="link" className="mt-2">
          Go back to Quiz
        </Button>
      </Alert>
    );
  }

  const scoreColor = quizFeedback.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Quiz Results: {quizFeedback.quiz_title}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Overall Performance</span>
            <Badge variant={quizFeedback.passed ? "default" : "destructive"} className={quizFeedback.passed ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""}>
              {quizFeedback.passed ? 'Passed' : 'Needs Review'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">Score:</span>
            <span className={`text-2xl font-bold ${scoreColor}`}>
              {quizFeedback.correct_answers} / {quizFeedback.total_questions} ({quizFeedback.score_percentage.toFixed(1)}%)
            </span>
          </div>
          {quizFeedback.total_time_taken_seconds && (
            <div className="flex justify-between items-baseline text-sm text-muted-foreground">
              <span>Total Time:</span>
              <span>{Math.floor(quizFeedback.total_time_taken_seconds / 60)}m {quizFeedback.total_time_taken_seconds % 60}s</span>
            </div>
          )}
          <Separator />
          <div>
            <h4 className="font-semibold mb-1 text-sm flex items-center"><Trophy className="w-4 h-4 mr-2 text-yellow-500"/>Overall Feedback:</h4>
            <p className="text-sm text-muted-foreground">{quizFeedback.overall_feedback}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center"><BookOpen className="w-5 h-5 mr-2 text-blue-500"/>Suggested Study Topics</CardTitle>
          </CardHeader>
          <CardContent>
            {quizFeedback.suggested_study_topics && quizFeedback.suggested_study_topics.length > 0 && quizFeedback.suggested_study_topics[0] !== "" ? (
              <ul className="list-disc list-inside space-y-1 text-sm">
                {quizFeedback.suggested_study_topics.map((topic, index) => <li key={index}>{topic}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No specific topics suggested. Great job!</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-purple-500"/>Recommended Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            {quizFeedback.next_steps && quizFeedback.next_steps.length > 0 ? (
              <ul className="list-disc list-inside space-y-1 text-sm">
                {quizFeedback.next_steps.map((step, index) => <li key={index}>{step}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Review the material or proceed as needed.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Question Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {quizFeedback.feedback_items.map((item, index) => (
            <div key={index} className="p-4 border rounded">
              <p className="font-semibold mb-1">Question {item.question_index + 1}: {item.question_text}</p>
              <div className="text-sm space-y-1">
                <p>Your answer: <span className={item.is_correct ? "text-green-600" : "text-red-600"}>{item.user_selected_option}</span></p>
                <p>Correct answer: <span className="text-green-600">{item.correct_option}</span></p>
                <p className="flex items-center">Result: {item.is_correct
                  ? <><CheckCircle2 className="w-4 h-4 text-green-500 ml-2 mr-1"/> Correct</>
                  : <><XCircle className="w-4 h-4 text-red-500 ml-2 mr-1"/> Incorrect</>
                }</p>
                <p className="text-muted-foreground pt-1"><span className="font-medium">Explanation:</span> {item.explanation}</p>
                {!item.is_correct && item.improvement_suggestion && (
                  <p className="text-blue-600 dark:text-blue-400 pt-1"><span className="font-medium">Suggestion:</span> {item.improvement_suggestion}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="text-center mt-8">
        <Button onClick={handleTriggerAnalysis} disabled={loadingState === 'loading'}>
          {loadingState === 'loading' ? 'Analyzing...' : 'Analyze Session Performance'}
        </Button>
        {loadingState === 'error' && error?.includes('analysis') && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      <div className="text-center mt-4">
        <Button variant="outline" onClick={() => router.push('/')}>Start New Session</Button>
      </div>
    </div>
  );
} 