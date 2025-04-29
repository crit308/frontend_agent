import { cn } from "../../lib/utils"; // Adjusted import
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"; // Adjusted import
import { Bot, User } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Skeleton } from '../ui/skeleton'; // Adjusted import

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  isLoading?: boolean;
}

interface ChatMessageProps {
  message: Message;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const { sender, text, isLoading } = message;
  const isUser = sender === 'user';

  return (
    <div className={cn("flex items-start gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <Avatar className="h-8 w-8 border">
          <AvatarImage src="/placeholder-bot.jpg" alt="AI" />
          <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "rounded-lg p-3 max-w-[75%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        {isLoading ? (
          <Skeleton className="h-5 w-20" />
        ) : (
          <div className="prose dark:prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline" />,
                p: ({node, ...props}) => <p {...props} className="mb-0" />
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 border">
          <AvatarImage src="/placeholder-user.jpg" alt="User" />
          <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default ChatMessage; 