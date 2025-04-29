import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Send } from 'lucide-react';
import ChatMessage from './ChatMessage';
import { ScrollArea } from '../ui/scroll-area';
import { useSessionStore } from '@/store/sessionStore'; // Import store
import { useShallow } from 'zustand/react/shallow'; // Import shallow

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  isLoading?: boolean;
}

const ChatInterface = () => {
  const [input, setInput] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const {
    sendInteraction,
    loadingState,
    connectionStatus
  } = useSessionStore(
    useShallow((state) => ({
      sendInteraction: state.sendInteraction,
      loadingState: state.loadingState,
      connectionStatus: state.connectionStatus,
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

  const messagesToDisplay: Message[] = [
      { id: 'placeholder-1', sender: 'ai', text: 'Chat history display is not implemented yet.' },
      { id: 'placeholder-2', sender: 'ai', text: 'You can send messages using the input below.' }
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messagesToDisplay]);

  return (
    <div className="flex flex-col h-full bg-background dark:bg-gray-950">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messagesToDisplay.map((message) => (
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