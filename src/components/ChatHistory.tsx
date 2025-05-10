'use client';

import React, { useEffect } from 'react';
import ExplanationViewComponent from '@/components/interaction/ExplanationView';
import FeedbackViewComponent from '@/components/views/FeedbackView';
import MessageViewComponent from '@/components/views/MessageView';
import type {
  TutorInteractionResponse,
  ExplanationResponse,
  FeedbackResponse,
  MessageResponse,
  ErrorResponse,
  WhiteboardAction
} from '@/lib/types';
import { useWhiteboard } from '@/contexts/WhiteboardProvider';
// Import ChatMessage from the store
import { type ChatMessage } from '@/store/sessionStore';
import { WhiteboardActivityIndicator } from '@/components/chat/WhiteboardActivityIndicator'; // Corrected import path

// --- Types ---
// Remove local UserMessage and ChatMessage union types
// export interface UserMessage { ... }
// type ChatMessage = TutorInteractionResponse | UserMessage;

interface ChatHistoryProps {
  messages: ChatMessage[]; // Use ChatMessage from store
  onNext: () => void;
}

// --- Helper Component for Tutor Message Rendering ---
interface TutorMessageRendererProps {
  interaction: TutorInteractionResponse | ErrorResponse; // Accept ErrorResponse too
  onNext: () => void;
}

const TutorMessageRenderer: React.FC<TutorMessageRendererProps> = ({ interaction, onNext }) => {
  // Removed the useEffect that was dispatching whiteboard_actions from here,
  // as it's now handled in useTutorStream.ts and actions are on ChatMessage.

  if (interaction.response_type === 'error') {
    return <div className="p-2 text-red-700 bg-red-100 rounded"><strong>Error:</strong> {interaction.message}</div>;
  }

  const tutorInteraction = interaction as TutorInteractionResponse;

  switch (tutorInteraction.response_type) {
      case 'explanation':
        return <ExplanationViewComponent content={tutorInteraction as ExplanationResponse} onNext={onNext} />;
      case 'question':
        // For questions, instruct the user to look at the whiteboard instead of rendering the MCQ in chat
        return (
          <div className="text-sm whitespace-pre-wrap">
            The tutor has a question for you on the whiteboard.
          </div>
        );
      case 'feedback': {
        const feedbackRes = tutorInteraction as FeedbackResponse;
        const firstItem = feedbackRes.feedback_items && feedbackRes.feedback_items.length > 0 ? feedbackRes.feedback_items[0] : null;
        if (!firstItem) {
          return (
            <div className="text-sm text-muted-foreground">Feedback received, but details are unavailable.</div>
          );
        }
        return <FeedbackViewComponent feedback={firstItem} onNext={onNext} />;
      }
      case 'message':
        return <MessageViewComponent content={tutorInteraction as MessageResponse} />;
      default:
        const unknownInteraction = tutorInteraction as any;
        // Removed 'follow_up_questions' case, will fall into default
        console.warn('[TutorMessageRenderer] Unknown interaction type:', unknownInteraction.response_type);
        return <div className="text-xs text-muted-foreground">Received an unknown message type from the tutor.</div>;
    }
};

// --- Component ---
const ChatHistory: React.FC<ChatHistoryProps> = ({ messages, onNext }) => {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="space-y-4">
      {messages.map((msg) => { // Use msg.id as key
        // --- User Message ---
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex justify-end">
              <div className="bg-primary text-primary-foreground p-3 rounded-lg max-w-[80%] shadow-sm">
                {msg.content} {/* Display the string content */}
              </div>
            </div>
          );
        }
        // --- Assistant Message ---
        else if (msg.role === 'assistant') {
          // Handle assistant messages, especially errors
          if (msg.interaction) {
            // Check for the specific non-conforming error structure from the backend
            // It has 'error_message' and lacks 'response_type'
            const interactionAsAny = msg.interaction as any;
            if (interactionAsAny.error_message !== undefined && interactionAsAny.response_type === undefined) {
              const errorData = interactionAsAny as { error_message: string; error_code?: string; technical_details?: any };
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="bg-red-100 border border-red-300 text-red-800 p-3 rounded-lg max-w-[80%] shadow-sm">
                    <strong>Error:</strong> {errorData.error_message}
                    {errorData.error_code && <span className="ml-1">({errorData.error_code})</span>}
                    {errorData.technical_details && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer">Technical Details</summary>
                        <pre className="mt-1 p-2 bg-red-50 rounded whitespace-pre-wrap break-all">
                          {typeof errorData.technical_details === 'string'
                            ? errorData.technical_details
                            : JSON.stringify(errorData.technical_details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            } else {
              const hasWhiteboardActions = msg.whiteboard_actions && msg.whiteboard_actions.length > 0;

              // Check if interaction is a simple status update message without response_type
              if (!('response_type' in msg.interaction) && 'message_text' in (msg.interaction as any)) {
                const interactionAsMessage = msg.interaction as any;
                return (
                  <div key={msg.id} className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg max-w-[80%] shadow-sm">
                      {hasWhiteboardActions && <WhiteboardActivityIndicator />}
                      {/* Fallback rendering for status messages */}
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {interactionAsMessage.message_text}
                      </div>
                    </div>
                  </div>
                );
              }

              // Normal interaction path (with response_type)
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="bg-muted p-3 rounded-lg max-w-[80%] shadow-sm">
                    {hasWhiteboardActions && <WhiteboardActivityIndicator />}
                    <TutorMessageRenderer
                      interaction={msg.interaction as TutorInteractionResponse}
                      onNext={onNext}
                    />
                  </div>
                </div>
              );
            }
          } else {
            // Render simple text content if no interaction object (e.g., "Session Ended" message)
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="bg-muted p-3 rounded-lg max-w-[80%] shadow-sm">
                  {/* Render WhiteboardActivityIndicator if actions are present (though unlikely without interaction) */}
                  {msg.whiteboard_actions && msg.whiteboard_actions.length > 0 && (
                    <WhiteboardActivityIndicator />
                  )}
                  <div>{msg.content}</div>
                </div>
              </div>
            );
          }
        }
        // --- Fallback for unexpected message types ---
        return <div key={msg.id} className="text-xs text-red-500">Unknown message role: {msg.role}</div>;
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatHistory; 