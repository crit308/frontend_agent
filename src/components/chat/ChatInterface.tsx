import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Send } from 'lucide-react';
import ChatMessage from './ChatMessage';
import { ScrollArea } from '../ui/scroll-area';
import { useSessionStore } from '@/store/sessionStore'; // Import store
import { useShallow } from 'zustand/react/shallow'; // Import shallow
import type { MessageResponse } from '@/lib/types'; // Import MessageResponse type
import { v4 as uuidv4 } from 'uuid'; // For generating unique message IDs

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  isLoading?: boolean;
}

const ChatInterface = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: uuidv4(), sender: 'ai', text: 'Welcome! Ask me anything about the document.' }
  ]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const {
    sendInteraction,
    loadingState,
    connectionStatus,
    currentInteractionContent
  } = useSessionStore(
    useShallow((state) => ({
      sendInteraction: state.sendInteraction,
      loadingState: state.loadingState,
      connectionStatus: state.connectionStatus,
      currentInteractionContent: state.currentInteractionContent
    }))
  );

  const isInputDisabled = connectionStatus !== 'connected' || loadingState === 'interacting';

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    }, 0);
  };

  const handleSendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isInputDisabled) return;

    const userMessage: Message = {
      id: uuidv4(),
      sender: 'user',
      text: trimmedInput,
    };
    setMessages(prev => [...prev, userMessage]);

    sendInteraction('user_message', { text: trimmedInput });
    setInput('');
    scrollToBottom();
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    if (
      currentInteractionContent &&
      currentInteractionContent.response_type === 'message'
    ) {
      const aiMessageContent = currentInteractionContent as MessageResponse;
      if (!messages.some(msg => msg.sender === 'ai' && msg.text === aiMessageContent.text)) {
        const aiMessage: Message = {
          id: uuidv4(),
          sender: 'ai',
          text: aiMessageContent.text,
        };
        setMessages(prev => [...prev, aiMessage]);
        scrollToBottom();
      }
    }
  }, [currentInteractionContent]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-background dark:bg-gray-950">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Textarea
            placeholder={isInputDisabled ? "Connecting or processing..." : "Type your message..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 resize-none"
            rows={1}
            disabled={isInputDisabled}
          />
          <Button onClick={handleSendMessage} disabled={isInputDisabled || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface; 