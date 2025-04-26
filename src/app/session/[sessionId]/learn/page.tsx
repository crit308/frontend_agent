'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSessionStore } from '@/store/sessionStore';
import ExplanationViewComponent from '@/components/interaction/ExplanationView';
import QuestionView from '@/components/views/QuestionView';
import { FeedbackView, MessageView } from '@/components/OrchestratorViews';
import type {
  ExplanationResponse,
  QuestionResponse,
  FeedbackResponse,
  MessageResponse,
  ErrorResponse,
  TutorInteractionResponse,
  QuizFeedbackItem
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
import ExplanationView from '@/components/views/ExplanationView';

export default function LearnPage() {
  console.log("LearnPage MOUNTING");

  const { sessionId } = useParams() as { sessionId?: string };
  const {
    currentInteractionContent,
    loadingState,
    error,
    connectionStatus,
    sendInteraction,
  } = useSessionStore(
    useShallow((state: SessionState) => ({
      currentInteractionContent: state.currentInteractionContent,
      loadingState: state.loadingState,
      error: state.error,
      connectionStatus: state.connectionStatus,
      sendInteraction: state.sendInteraction,
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

  // Effect to handle auto-advance on the last explanation segment
  useEffect(() => {
    if (
      currentInteractionContent &&
      currentInteractionContent.response_type === 'explanation' &&
      currentInteractionContent.is_last_segment === true
    ) {
      console.log('[LearnPage] Last explanation segment received, auto-advancing...');
      // Short delay to allow user to read the last segment briefly before transition
      const timer = setTimeout(() => {
           sendInteraction('next');
      }, 1500); // 1.5 second delay

      return () => clearTimeout(timer); // Cleanup timeout on unmount or if content changes
    }
  }, [currentInteractionContent, sendInteraction]);

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
    // Loading/Error/Missing states handled outside this function now

    const interactionContent = currentInteractionContent as TutorInteractionResponse | null;

    if (!interactionContent) {
      console.warn("renderWhiteboardContent: interactionContent is null/undefined during render. LoadingState:", loadingState);
      return loadingState === 'interacting' ? <LoadingSpinner message="Processing..." /> : null;
    }

    if (typeof interactionContent !== 'object' || !('response_type' in interactionContent)) {
        console.warn("Received content without response_type property:", interactionContent);
        return <p className="p-4 text-muted-foreground">Received unexpected content from tutor.</p>;
    }

    switch (interactionContent.response_type) {
      case 'explanation': {
        const explanationContent = interactionContent as ExplanationResponse;
        return (
          <ExplanationView
            content={explanationContent}
            showNextButton={!explanationContent.is_last_segment}
            onNext={() => sendInteraction('next')}
          />
        );
      }
      case 'question': {
        const questionContent = interactionContent as QuestionResponse;
        if (!questionContent.question || !questionContent.question.options) {
          console.error("LearnPage: Received invalid question data structure", interactionContent);
          return <p className="text-red-600 p-4">Error: Received invalid question data format.</p>;
        }
        return (
          <QuestionView
            content={questionContent}
          />
        );
      }
      case 'feedback': {
        if (!interactionContent) {
          console.error("LearnPage: interactionContent became null/undefined INSIDE feedback case!");
          return <p>Error: Internal state inconsistency.</p>;
        }

        const feedbackData = interactionContent as FeedbackResponse;
        if (!feedbackData || typeof feedbackData !== 'object') {
          console.error("LearnPage: feedbackData is invalid inside feedback case.", { interactionContent });
          return <p>Error: Invalid feedback data structure received.</p>;
        }

        const feedbackItem = (feedbackData as any).item as QuizFeedbackItem;

        if (!feedbackItem) {
          console.error("LearnPage: feedbackData is missing 'item' property inside 'feedback' case.", { interactionContent });
          return <p className="text-red-600 p-4">Error: Received invalid feedback data format (missing 'item').</p>;
        }
        return (
          <FeedbackView
            feedback={feedbackItem}
            onNext={() => sendInteraction('next')}
          />
        );
      }
      case 'message': {
        const { text } = interactionContent;
        return <MessageView text={text} />;
      }
      case 'error': {
        const { message, error_code } = interactionContent;
        return (
          <Alert variant="destructive" className="m-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Tutor Error ({error_code || 'Unknown'})</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        );
      }
      default:
        console.warn("Unknown response type in renderWhiteboardContent:", (interactionContent as any).response_type);
        return <p className="p-4 text-muted-foreground">Received unknown content type: {(interactionContent as any).response_type}</p>;
    }
  };

  return (
    <>
      <div className="flex h-[calc(100vh-8rem)] border rounded-lg overflow-hidden">

        <div className="w-1/3 border-r flex flex-col h-full">
          {missingCredentials || isAuthError ? (
             <div className="p-4 text-center text-muted-foreground">Chat unavailable</div>
          ) : sessionId && jwt ? (
           <TutorChat sessionId={sessionId} jwt={jwt} />
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