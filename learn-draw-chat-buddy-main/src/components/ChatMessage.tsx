
import { FC } from 'react';
import { Avatar } from '@/components/ui/avatar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: FC<ChatMessageProps> = ({ message }) => {
  const isAI = message.role === 'assistant';
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={`flex gap-3 ${isAI ? 'animate-fade-in' : ''}`}
    >
      <Avatar className={`h-8 w-8 ${isAI ? 'bg-tutor-primary text-white' : 'bg-gray-300'} flex items-center justify-center`}>
        <span className="text-sm font-medium">
          {isAI ? 'AI' : 'You'}
        </span>
      </Avatar>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">
            {isAI ? 'AI Tutor' : 'You'}
          </p>
          <span className="text-xs text-gray-400">
            {formatTime(message.timestamp)}
          </span>
        </div>
        
        <div className="mt-1 text-gray-700 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
