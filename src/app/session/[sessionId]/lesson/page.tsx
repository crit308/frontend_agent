'use client';

import React, { useEffect, useState, useRef } from 'react';
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

  // Individual selectors to avoid unnecessary re-renders
  const lessonContent = useSessionStore(state => state.lessonContent);
  const loadingState = useSessionStore(state => state.loadingState);
  const error = useSessionStore(state => state.error);
  const setLoading = useSessionStore(state => state.setLoading);
  const setError = useSessionStore(state => state.setError);
  const setLessonContent = useSessionStore(state => state.setLessonContent);
  const loadingMessage = useSessionStore(state => state.loadingMessage);

  const [localLoading, setLocalLoading] = useState(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid session ID.');
      setLocalLoading(false);
      return;
    }

    // Prevent fetching if already fetching, or if content exists, or if there was a persistent error
    if (isFetchingRef.current || lessonContent || (error && loadingState === 'error')) {
      setLocalLoading(false); // Ensure spinner stops
      return;
    }

    const fetchLesson = async () => {
      isFetchingRef.current = true; // Mark as fetching
      setLocalLoading(true);
      setLoading('loading', 'Fetching lesson content...');
      
      try {
        console.log(`Attempting to fetch lesson for session: ${sessionId}`);
        const data = await api.getLessonContent(sessionId);

        if (!data || !data.sections || data.sections.length === 0) {
          console.log('Lesson content is null/undefined or empty from API.');
          setLoading('loading', 'Lesson content might still be generating...');
          // Implement a limited retry with timeout
          await new Promise(resolve => setTimeout(resolve, 7000));
          const retryData = await api.getLessonContent(sessionId);
          if (!retryData || !retryData.sections || retryData.sections.length === 0) {
            throw new Error("Lesson content not found after waiting.");
          }
          setLessonContent(retryData);
          setLoading('success');
        } else {
          setLessonContent(data);
          setLoading('success');
        }
      } catch (err: any) {
        console.error("Failed to fetch lesson content:", err);
        const errorMessage = err.response?.data?.detail || err.message || 'Failed to load lesson.';
        setError(errorMessage);
        setLoading('error', errorMessage);
      } finally {
        setLocalLoading(false);
        isFetchingRef.current = false; // Mark fetching as complete
      }
    };

    fetchLesson();
  }, [sessionId, setError, setLessonContent, setLoading]);

  const handleProceedToQuiz = () => {
    if (sessionId) {
      setLoading('idle');
      router.push(`/session/${sessionId}/quiz`);
    }
  };

  if (localLoading || loadingState === 'loading' && !lessonContent) {
    return <LoadingSpinner message={loadingMessage || 'Loading lesson...'} />;
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