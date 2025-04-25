'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSessionStore } from '@/store/sessionStore';
import {
  ExplanationView,
  QuestionView,
  FeedbackView,
  MessageView,
} from '@/components/OrchestratorViews';
import type {
  ExplanationResponse,
  QuestionResponse,
  FeedbackResponse,
  MessageResponse,
  ErrorResponse,
  TutorInteractionResponse
} from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTutorStream } from '../../../../../lib/useTutorStream';
import TutorChat from '@/components/TutorChat';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionState } from '@/store/sessionStore';

export default function LearnPage() {
  const { sessionId } = useParams() as { sessionId?: string };
  const {
    currentInteractionContent,
    loadingState,
    error,
    sendInteraction,
    currentQuizQuestion
  } = useSessionStore(
    useShallow((state: SessionState) => ({
      currentInteractionContent: state.currentInteractionContent,
      loadingState: state.loadingState,
      error: state.error,
      sendInteraction: state.sendInteraction,
      currentQuizQuestion: state.currentQuizQuestion,
    }))
  );

  const { session, loading: authLoading } = useAuth();
  const jwt = session?.access_token || '';

  const streamHandlers = React.useMemo(() => ({
  }), []);

  const { connected, latency } = useTutorStream(sessionId || '', jwt, streamHandlers);

  console.log('[LearnPage] Rendering. InteractionContent:', currentInteractionContent, 'Connected:', connected, 'LoadingState:', loadingState, 'AuthLoading:', authLoading);

  if (authLoading || (!connected && loadingState === 'loading')) {
     return <LoadingSpinner message="Initializing Session..." />;
  }
  if (!sessionId || !jwt) {
     return <p className="text-red-500 p-4">Error: Session ID or authentication token is missing.</p>;
  }
  if (error && loadingState === 'error') {
       return (
           <Alert variant="destructive" className="m-4">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Session Error</AlertTitle>
             <AlertDescription>{error}</AlertDescription>
           </Alert>
       );
   }
   if (!connected && loadingState !== 'loading') {
        return (
             <Alert variant="destructive" className="m-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Connection Lost</AlertTitle>
                <AlertDescription>WebSocket disconnected. Attempting to reconnect...</AlertDescription>
             </Alert>
        );
   }

  const renderWhiteboardContent = () => {
    const interactionContent = currentInteractionContent as TutorInteractionResponse | null;
    if (!interactionContent) {
        if (loadingState === 'interacting') {
             return <LoadingSpinner message="Tutor is thinking..." />;
        }
        return <p className="p-4 text-muted-foreground">Waiting for tutor...</p>;
    }
    if (typeof interactionContent !== 'object' || interactionContent === null || !('response_type' in interactionContent)) {
        console.warn("Received content without response_type:", interactionContent);
        return <p className="p-4 text-muted-foreground">Received unexpected content from tutor.</p>;
    }
    const typedContent = interactionContent as TutorInteractionResponse;
    switch (typedContent.response_type) {
      case 'explanation':
        const explanationData = typedContent as ExplanationResponse;
        return (
          <ExplanationView
            text={explanationData.text}
            onNext={() => sendInteraction('next')}
          />
        );
      case 'question':
        const questionData = typedContent as QuestionResponse;
        if (!questionData.question || !questionData.question.options) {
            return <p className="text-red-600 p-4">Error: Received invalid question data.</p>;
        }
        return (
          <QuestionView
            question={questionData.question}
            onAnswer={(idx) => sendInteraction('answer', { answer_index: idx })}
          />
        );
      case 'feedback':
        const feedbackData = typedContent as FeedbackResponse;
         if (!feedbackData.feedback) {
            return <p className="text-red-600 p-4">Error: Received invalid feedback data.</p>;
  }
        return (
          <FeedbackView
            feedback={feedbackData.feedback}
            onNext={() => sendInteraction('next')}
          />
        );
      case 'message':
         return <p className="p-4 text-muted-foreground text-center">...</p>;
      case 'error':
        const errorData = typedContent as ErrorResponse;
        return (
            <Alert variant="destructive" className="m-4">
                 <AlertTriangle className="h-4 w-4" />
                 <AlertTitle>Tutor Error</AlertTitle>
                 <AlertDescription>{errorData.message}</AlertDescription>
            </Alert>
        );
      default:
        // @ts-ignore
        console.warn("Unknown response type:", typedContent.response_type);
        // @ts-ignore
        return <p className="p-4 text-muted-foreground">Received unknown content type: {typedContent.response_type}</p>;
    }
  };

  return (
    <>
      <div className="flex h-[calc(100vh-8rem)] border rounded-lg overflow-hidden">

        <div className="w-1/3 border-r flex flex-col h-full">
          {sessionId && jwt ? (
           <TutorChat sessionId={sessionId} jwt={jwt} />
          ) : (
            <LoadingSpinner message="Loading Chat..." />
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 h-full">
          {renderWhiteboardContent()}
        </div>

      </div>

       <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, background: 'rgba(30,41,59,0.85)', color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div>WS Status: {connected ? <span style={{color: 'lightgreen'}}>Connected</span> : <span style={{color: 'salmon'}}>Disconnected</span>}</div>
         <div>WS Latency: {latency !== null ? `${latency} ms` : '—'}</div>
       </div>
    </>
  );
} 