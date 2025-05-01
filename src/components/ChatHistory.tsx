'use client';

import React, { useEffect } from 'react';
import ExplanationViewComponent from '@/components/interaction/ExplanationView';
import QuestionView from '@/components/views/QuestionView';
import FeedbackViewComponent from '@/components/views/FeedbackView';
import MessageViewComponent from '@/components/views/MessageView';
import type {
  TutorInteractionResponse,
  ExplanationResponse,
  QuestionResponse,
  FeedbackResponse,
  MessageResponse,
  ErrorResponse,
  WhiteboardAction
} from '@/lib/types';
import { useWhiteboard } from '@/contexts/WhiteboardProvider';
// Import ChatMessage from the store
import { type ChatMessage } from '@/store/sessionStore';

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
  const { dispatchWhiteboardAction } = useWhiteboard();

  // Effect to dispatch whiteboard actions when the interaction data changes
  useEffect(() => {
    // Log the interaction received for this specific message instance
    console.log('[TutorMessageRenderer] Checking actions for interaction:', interaction);

    // Check if it's a TutorInteractionResponse (not ErrorResponse) before looking for actions
    if (interaction && 'response_type' in interaction && interaction.response_type !== 'error') {
      const tutorResponse = interaction as TutorInteractionResponse;

      // Log the specific whiteboard_actions property
      console.log('[TutorMessageRenderer] whiteboard_actions property:', tutorResponse.whiteboard_actions);

      // Check if whiteboard_actions exist and are an array with items
      if (
        'whiteboard_actions' in tutorResponse &&
        Array.isArray(tutorResponse.whiteboard_actions) &&
        tutorResponse.whiteboard_actions.length > 0
      ) {
        // Ensure the type matches WhiteboardAction[] before dispatching
        const actionsToDispatch = tutorResponse.whiteboard_actions as WhiteboardAction[];
        console.log(`[TutorMessageRenderer] Dispatching ${actionsToDispatch.length} actions:`, actionsToDispatch);
        dispatchWhiteboardAction(actionsToDispatch);
      } else {
        console.log('[TutorMessageRenderer] No valid whiteboard actions found to dispatch.');
      }
    } else {
      console.log('[TutorMessageRenderer] Interaction is null, an error, or lacks response_type. Skipping action dispatch.');
    }
    // The dependency array already includes interaction and dispatchWhiteboardAction
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction, dispatchWhiteboardAction]);

  // Render the specific view based on interaction type
  // Type guard for ErrorResponse
  if (interaction.response_type === 'error') {
    return <div className="p-2 text-red-700 bg-red-100 rounded"><strong>Error:</strong> {interaction.message}</div>;
  }

  // Now we know it's TutorInteractionResponse (excluding ErrorResponse)
  const tutorInteraction = interaction as TutorInteractionResponse;

  switch (tutorInteraction.response_type) {
      case 'explanation':
        return <ExplanationViewComponent content={tutorInteraction as ExplanationResponse} onNext={onNext} />;
      case 'question':
        return <QuestionView content={tutorInteraction as QuestionResponse} />;
      case 'feedback':
        return <FeedbackViewComponent feedback={(tutorInteraction as FeedbackResponse).item} onNext={onNext} />;
      case 'follow_up_questions':
        return (
          <div className="text-xs text-muted-foreground">
            Follow-up questions are not supported in this version.
          </div>
        );
      case 'message':
        return <MessageViewComponent content={tutorInteraction as MessageResponse} />;
      // Error case handled above
      default:
        const unknownInteraction = tutorInteraction as any;
        return <div className="text-xs text-muted-foreground">Unknown interaction type: {unknownInteraction.response_type}</div>;
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
          // Check if the original interaction object exists
          if (msg.interaction) {
              // interaction could be TutorInteractionResponse or ErrorResponse
              const interaction = msg.interaction;
               return (
                <div key={msg.id} className="flex justify-start">
                  <div className="bg-muted p-3 rounded-lg max-w-[80%] shadow-sm">
                     {/* Render based on the stored interaction object */}
                    <TutorMessageRenderer interaction={interaction} onNext={onNext} />
                  </div>
                </div>
              );
          } else {
             // Render assistant message string content if interaction object is missing (e.g., simple session ended message)
             return (
               <div key={msg.id} className="flex justify-start">
                  <div className="bg-muted p-3 rounded-lg max-w-[80%] shadow-sm">
                    {msg.content}
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