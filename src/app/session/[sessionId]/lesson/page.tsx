'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSessionStore } from '@/store/sessionStore';
import * as api from '@/lib/api';
import { LessonContent } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import LessonDisplay from '@/components/LessonDisplay';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : null;

  const {
    lessonContent,
    setLessonContent,
    loadingState,
    setLoading,
    error,
    setError,
  } = useSessionStore(state => ({
    lessonContent: state.lessonContent,
    setLessonContent: state.setLessonContent,
    loadingState: state.loadingState,
    setLoading: state.setLoading,
    error: state.error,
    setError: state.setError,
  }));

  const [localLoading, setLocalLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid session ID.');
      setLocalLoading(false);
      return;
    }

    const fetchLesson = async () => {
      setLocalLoading(true);
      setLoading('loading', 'Fetching lesson content...');
      setError(null);
      try {
        const data = await api.getLessonContent(sessionId);
        if (!data || !data.sections || data.sections.length === 0) {
          setLoading('loading', 'Lesson content is still generating, please wait...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          const retryData = await api.getLessonContent(sessionId);
          if (!retryData || !retryData.sections || retryData.sections.length === 0) {
            throw new Error("Lesson content generation timed out or failed.");
          }
          setLessonContent(retryData);
        } else {
          setLessonContent(data);
        }
        setLoading('success');
      } catch (err: any) {
        console.error("Failed to fetch lesson content:", err);
        const errorMessage = err.response?.data?.detail || err.message || 'Failed to load lesson.';
        setError(errorMessage);
        setLoading('error', errorMessage);
      } finally {
        setLocalLoading(false);
      }
    };

    fetchLesson();

  }, [sessionId, setLessonContent, setLoading, setError]);

  const handleProceedToQuiz = () => {
    if (sessionId) {
      setLoading('idle');
      router.push(`/session/${sessionId}/quiz`);
    }
  };

  if (localLoading || loadingState === 'loading' && !lessonContent) {
    return <LoadingSpinner message={useSessionStore.getState().loadingMessage || 'Loading lesson...'} />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Loading Lesson</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={() => router.push('/')} variant="link" className="mt-2">Go back to start</Button>
      </Alert>
    );
  }

  if (!lessonContent) {
    return (
      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>No Lesson Content</AlertTitle>
        <AlertDescription>Lesson content could not be loaded or is not available.</AlertDescription>
        <Button onClick={() => router.push('/')} variant="link" className="mt-2">Go back to start</Button>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <LessonDisplay lessonContent={lessonContent} />
      <div className="mt-8 text-center">
        <Button onClick={handleProceedToQuiz} size="lg">
          Proceed to Quiz
        </Button>
      </div>
    </div>
  );
} 