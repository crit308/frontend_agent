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

// --- Types ---
// Define UserMessage type locally
export interface UserMessage {
  type: 'user';
  text: string;
  // timestamp?: Date; // Optional timestamp
}

// Union type for messages in the history
type ChatMessage = TutorInteractionResponse | UserMessage;

interface ChatHistoryProps {
  messages: ChatMessage[];
  onNext: () => void; // Add onNext prop for components that need it
  // interactionContent: TutorInteractionResponse | null; // Removed, using messages array now
}

// --- Helper Component for Tutor Message Rendering ---
interface TutorMessageRendererProps {
  interaction: TutorInteractionResponse;
  onNext: () => void;
}

const TutorMessageRenderer: React.FC<TutorMessageRendererProps> = ({ interaction, onNext }) => {
  const { dispatchWhiteboardAction } = useWhiteboard();

  // Effect to dispatch whiteboard actions when the interaction data changes
  useEffect(() => {
    // Check if whiteboard_actions exist and are an array with items
    if (
      interaction &&
      'whiteboard_actions' in interaction &&
      Array.isArray(interaction.whiteboard_actions) &&
      interaction.whiteboard_actions.length > 0
    ) {
      console.log(`[TutorMessageRenderer] Dispatching ${interaction.whiteboard_actions.length} whiteboard actions for message.`);
      // Ensure the type matches WhiteboardAction[] before dispatching
      const actionsToDispatch = interaction.whiteboard_actions as WhiteboardAction[];
      dispatchWhiteboardAction(actionsToDispatch);
    }
  }, [interaction, dispatchWhiteboardAction]); // Depend on interaction object and dispatch function

  // Render the specific view based on interaction type
  switch (interaction.response_type) {
      case 'explanation':
        return <ExplanationViewComponent content={interaction as ExplanationResponse} onNext={onNext} />;
      case 'question':
        return <QuestionView content={interaction as QuestionResponse} />;
      case 'feedback':
        return <FeedbackViewComponent feedback={(interaction as FeedbackResponse).feedback} onNext={onNext} />;
      case 'message':
        return <MessageViewComponent content={interaction as MessageResponse} />;
      case 'error':
        return <div className="p-2 text-red-700 bg-red-100 rounded"><strong>Error:</strong> {(interaction as ErrorResponse).message}</div>;
      default:
        const unknownInteraction = interaction as any;
        return <div className="text-xs text-muted-foreground">Unknown interaction type: {unknownInteraction.response_type}</div>;
    }
};

// --- Component ---
const ChatHistory: React.FC<ChatHistoryProps> = ({ messages, onNext }) => {
  // Scroll to bottom logic
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="space-y-4">
      {messages.map((msg, index) => {
        // --- User Message --- 
        if ('type' in msg && msg.type === 'user') {
          return (
            <div key={index} className="flex justify-end">
              <div className="bg-primary text-primary-foreground p-3 rounded-lg max-w-[80%] shadow-sm">
                {msg.text}
              </div>
            </div>
          );
        }
        // --- Tutor Response --- 
        else if ('response_type' in msg) {
          const interaction = msg as TutorInteractionResponse;
          return (
            <div key={index} className="flex justify-start">
              <div className="bg-muted p-3 rounded-lg max-w-[80%] shadow-sm">
                <TutorMessageRenderer interaction={interaction} onNext={onNext} />
              </div>
            </div>
          );
        }
        // --- Fallback for unexpected message types --- 
        return <div key={index} className="text-xs text-red-500">Unknown message format</div>;
      })}
      <div ref={messagesEndRef} /> {/* Element to scroll to */}
    </div>
  );
};

export default ChatHistory; 