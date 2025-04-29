
import { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import Whiteboard from '@/components/Whiteboard';
import { useIsMobile } from '@/hooks/use-mobile';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const Index = () => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'chat' | 'whiteboard'>('whiteboard'); // Default to whiteboard
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-tutor-secondary p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-tutor-primary text-center">AI Tutor</h1>
          <p className="text-center text-gray-600 mt-2">Your personal AI tutor for interactive learning</p>
        </header>
        
        {isMobile ? (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden h-[calc(100vh-180px)]">
            <Tabs defaultValue="whiteboard" className="w-full">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="whiteboard">Whiteboard</TabsTrigger>
              </TabsList>
              <TabsContent value="chat" className="h-[calc(100vh-240px)]">
                <ChatInterface />
              </TabsContent>
              <TabsContent value="whiteboard" className="h-[calc(100vh-240px)]">
                <Whiteboard />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="h-[calc(100vh-180px)]">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full flex">
              <div className="w-1/3 border-r border-gray-200 h-full flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-800">Chat with AI Tutor</h2>
                </div>
                <div className="h-[calc(100%-60px)]">
                  <ChatInterface />
                </div>
              </div>
              
              <div className="w-2/3 h-full flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-800">Interactive Whiteboard</h2>
                </div>
                <div className="h-[calc(100%-60px)]">
                  <Whiteboard />
                </div>
              </div>
            </div>
          </div>
        )}
        
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>AI Tutor © {new Date().getFullYear()} | Ask any question to get interactive help</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
