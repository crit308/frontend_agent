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
import type { StructuredError } from '@/store/sessionStore';

export default function LearnPage() {
  console.log("LearnPage MOUNTING");

  const { sessionId } = useParams() as { sessionId?: string };
  const {
    currentInteractionContent,
    loadingState,
    error,
    connectionStatus,
    sendInteraction,
    currentQuizQuestion
  } = useSessionStore(
    useShallow((state: SessionState) => ({
      currentInteractionContent: state.currentInteractionContent,
      loadingState: state.loadingState,
      error: state.error,
      connectionStatus: state.connectionStatus,
      sendInteraction: state.sendInteraction,
      currentQuizQuestion: state.currentQuizQuestion,
    }))
  );

  const { session, loading: authLoading } = useAuth();
  const jwt = session?.access_token || '';

  const streamHandlers = React.useMemo(() => ({
  }), []);

  const { latency } = useTutorStream(sessionId || '', jwt, streamHandlers);

  useEffect(() => {
    return () => {
      console.log("LearnPage UNMOUNTING");
    };
  }, []);

  console.log('[LearnPage] Rendering. InteractionContent:', currentInteractionContent, 'Status:', connectionStatus, 'LoadingState:', loadingState, 'AuthLoading:', authLoading);

  // Determine status color based on connectionStatus
  const getStatusColor = (status: typeof connectionStatus): string => {
    switch (status) {
      case 'connected': return 'lightgreen';
      case 'connecting':
      case 'reconnecting': return 'orange';
      case 'error':
      case 'auth_error': return 'salmon';
      case 'idle':
      default: return 'grey';
    }
  };
  const statusColor = getStatusColor(connectionStatus);

  // Determine loading/error states first
  const isLoading = authLoading || connectionStatus === 'connecting' || connectionStatus === 'reconnecting';
  const isAuthError = connectionStatus === 'auth_error';
  const isConnectionError = connectionStatus === 'error';
  const isErrorState = isAuthError || isConnectionError;
  const missingCredentials = !sessionId || !jwt;

  // Prepare error details if needed
  const errorDetails = error as StructuredError | null;
  const errorTitle = isAuthError ? "Authentication Error" : "Connection Error";
  const errorMessage = errorDetails?.message || (isAuthError ? "Authentication failed. Please log in again." : "An unexpected error occurred.");

  const renderWhiteboardContent = () => {
    if (isLoading || isErrorState || missingCredentials) {
        return null; // Don't render whiteboard content if page is loading/in error state
    }

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
       const messageData = typedContent as MessageResponse;
       return <MessageView text={messageData.text} />;
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
          {missingCredentials || isAuthError ? (
             <div className="p-4 text-center text-muted-foreground">Chat unavailable</div>
          ) : sessionId && jwt ? (
           <TutorChat sessionId={sessionId} jwt={jwt} connectionStatus={connectionStatus} />
          ) : (
             <div className="p-4 flex items-center justify-center h-full">
                <LoadingSpinner message="Loading Chat..." />
             </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 h-full flex items-center justify-center">
          {isLoading ? (
             <LoadingSpinner message={connectionStatus === 'connecting' ? "Connecting..." : connectionStatus === 'reconnecting' ? "Reconnecting..." : "Initializing Session..."} />
          ) : isErrorState ? (
            <Alert variant="destructive" className="max-w-md">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{errorTitle}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : missingCredentials ? (
            <p className="text-red-500">Error: Session ID or authentication token is missing.</p>
          ) : (
            <div className="w-full h-full">{renderWhiteboardContent()}</div>
          )}
        </div>

      </div>

       <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, background: 'rgba(30,41,59,0.85)', color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div>WS Status: <span style={{ color: statusColor }}>{connectionStatus.toUpperCase()}</span></div>
         <div>WS Latency: {latency !== null ? `${latency} ms` : '—'}</div>
       </div>
    </>
  );
} 