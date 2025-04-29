'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import LoadingSpinner from '@/components/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionState } from '@/store/sessionStore';
import type { StructuredError } from '@/store/sessionStore';
import ExplanationView from '@/components/views/ExplanationView';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import Whiteboard from '@/components/whiteboard/Whiteboard';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { useWhiteboardStore } from '@/store/whiteboardStore';

export default function LearnPage() {
  console.log("LearnPage MOUNTING");

  const { sessionId } = useParams() as { sessionId?: string };
  const router = useRouter();
  const { toast } = useToast();
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [userInput, setUserInput] = useState('');
  const {
    currentInteractionContent,
    loadingState,
    error,
    connectionStatus,
    sendInteraction,
    sessionEndedConfirmed,
  } = useSessionStore(
    useShallow((state: SessionState) => ({
      currentInteractionContent: state.currentInteractionContent,
      loadingState: state.loadingState,
      error: state.error,
      connectionStatus: state.connectionStatus,
      sendInteraction: state.sendInteraction,
      sessionEndedConfirmed: state.sessionEndedConfirmed,
    }))
  );

  const { session, loading: authLoading } = useAuth();
  const jwt = session?.access_token || '';

  const streamHandlers = React.useMemo(() => ({
  }), []);

  const { latency } = useTutorStream(sessionId || '', jwt, streamHandlers);

  // Get whiteboard action
  const addChatBubble = useWhiteboardStore(state => state.addChatBubble);

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

  // Effect to handle session ended confirmation and redirect
  useEffect(() => {
    if (sessionEndedConfirmed) {
      console.log('[LearnPage] Session end confirmed by backend.');
      toast({
        title: "Session Ended",
        description: "Analysis is processing in the background.",
        duration: 5000, // Show toast for 5 seconds
      });

      // Redirect after a delay
      const redirectTimer = setTimeout(() => {
        router.push('/'); // Redirect to home page
      }, 3000); // 3 second delay before redirect

      return () => clearTimeout(redirectTimer); // Cleanup timer on unmount
    }
  }, [sessionEndedConfirmed, router, toast]);

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

  // Handler for ending the session
  const handleEndSession = async () => {
    if (!sessionId) return;
    setIsEndingSession(true);
    try {
      await sendInteraction('end_session', { session_id: sessionId });
      console.log('Session end interaction sent.');
    } catch (error) {
      console.error('Failed to send end session interaction:', error);
      toast({
        title: "Error Ending Session",
        description: (error as Error)?.message || "Could not send end session request.",
        variant: "destructive",
      });
      setIsEndingSession(false);
    }
  };

  // --- Input Bar Logic ---
  const isInputDisabled = connectionStatus !== 'connected' || loadingState === 'interacting';

  const handleSendMessage = useCallback(async () => {
    const trimmedInput = userInput.trim();
    if (!trimmedInput || isInputDisabled) return;

    console.log('[LearnPage] Sending user message:', trimmedInput);
    sendInteraction('user_message', { text: trimmedInput });
    setUserInput('');

    // Add user message bubble to whiteboard
    addChatBubble(trimmedInput, { role: 'user' });

    // In PHASE 2, we'll also call boardAPI.addChatBubble(trimmedInput) here
  }, [userInput, isInputDisabled, sendInteraction, addChatBubble]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);
  // --- End Input Bar Logic ---

  const renderWhiteboardContent = () => {
    // This function now just returns the content to be potentially rendered *onto* the whiteboard later
    // For now, it's unused as the whiteboard takes the full screen.
    // In PHASE 2/3, this logic might be adapted to feed content *to* the whiteboard API.
    return null; // Placeholder - logic will move
  };

  // --- Loading and Error States Handling ---
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen w-screen"><LoadingSpinner message={connectionStatus === 'connecting' ? "Connecting..." : connectionStatus === 'reconnecting' ? "Reconnecting..." : "Initializing Session..."} /></div>;
  }

  if (isErrorState || missingCredentials) {
    const title = missingCredentials ? "Missing Information" : errorTitle;
    const description = missingCredentials ? "Session ID or authentication token is missing." : errorMessage;
    return (
      <div className="flex items-center justify-center h-screen w-screen p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{description}</AlertDescription>
        </Alert>
      </div>
    );
  }
  // --- End Loading and Error States ---

  return (
    // Main container is now just the whiteboard + the input bar
    <div className="relative h-full w-full flex flex-col bg-background">
      {/* Whiteboard takes up all space except the input bar */}
      <div className="flex-1 overflow-hidden"> {/* Added overflow-hidden */}
        <Whiteboard /> {/* Pass necessary props if needed later */}
      </div>

      {/* Input Bar at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Textarea
            placeholder={isInputDisabled ? "Connecting or processing..." : "Type your message..."}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 resize-none shadow-md" // Added shadow
            rows={1}
            disabled={isInputDisabled}
          />
          <Button onClick={handleSendMessage} disabled={isInputDisabled || !userInput.trim()} size="icon" className="shadow-md"> {/* Added shadow */}
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
          {/* Optional: Add End Session Button here? */}
          {/* <Button variant="outline" onClick={handleEndSession} disabled={isEndingSession}>End Session</Button> */}
        </div>
      </div>

      {/* Render status indicators - maybe overlay top-right? */}
      {/* Example: */}
      {/* <div className="absolute top-2 right-2 flex items-center gap-2 p-1 bg-gray-700/50 text-white text-xs rounded">
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block' }}></span>
        {connectionStatus} {latency !== null ? `(${latency}ms)` : ''}
      </div> */}
    </div>
  );
} 