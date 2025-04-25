import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTutorStream } from '../../lib/useTutorStream';
import { nanoid } from 'nanoid';
import { useSessionStore } from '@/store/sessionStore';

interface Message {
  id: string;
  text: string;
  from: 'user' | 'tutor';
}

export default function TutorChat({ sessionId, jwt }: { sessionId: string; jwt: string }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const tutorMsgIdRef = useRef<string | null>(null);
  const currentTutorMessage = useRef<string>('');

  const handleOpen = useCallback(() => {
    console.log('[TutorChat] WS connected');
  }, []);

  const handleRawResponse = useCallback((delta: string) => {
    currentTutorMessage.current += delta;
    setMessages(prev => {
      const existingMsgIndex = prev.findIndex(msg => msg.id === tutorMsgIdRef.current);
      if (tutorMsgIdRef.current !== null && existingMsgIndex > -1) {
        const updatedMessages = [...prev];
        updatedMessages[existingMsgIndex] = {
          ...updatedMessages[existingMsgIndex],
          text: currentTutorMessage.current
        };
        return updatedMessages;
      } else {
        const id = nanoid();
        tutorMsgIdRef.current = id;
        return [...prev, { id, text: currentTutorMessage.current, from: 'tutor' }];
      }
    });
  }, []);

  const handleInteractionResponse = useCallback((response: any) => {
    console.log("[TutorChat] Received structured response in chat:", response);
    tutorMsgIdRef.current = null;
    currentTutorMessage.current = '';
  }, []);

  const handleError = useCallback((err: any) => {
    console.error('[TutorChat] error', err);
    const errorText = `Error: ${err?.message || 'Connection issue. Please refresh or try again.'}`;
    setMessages(prev => {
      if (prev.length > 0 && prev[prev.length - 1].text.startsWith("Error:")) {
        return prev;
      }
      return [...prev, { id: nanoid(), text: errorText, from: 'tutor' }];
    });
    tutorMsgIdRef.current = null;
    currentTutorMessage.current = '';
  }, []);

  const handleClose = useCallback(() => {
    console.log('[TutorChat] WS closed');
    tutorMsgIdRef.current = null;
    currentTutorMessage.current = '';
  }, []);

  const handleUnhandled = useCallback((evt: any) => {
    console.warn('[TutorChat] unhandled event', evt);
  }, []);

  const { connected, send } = useTutorStream(sessionId, jwt, {
    onOpen: handleOpen,
    onRawResponse: handleRawResponse,
    onInteractionResponse: handleInteractionResponse,
    onError: handleError,
    onClose: handleClose,
    onUnhandled: handleUnhandled,
  });

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || !connected) return;

    const userMsg = { id: nanoid(), text: trimmedInput, from: 'user' as const };
    setMessages(prev => [...prev, userMsg]);

    tutorMsgIdRef.current = null;
    currentTutorMessage.current = '';

    send({ type: 'user_message', data: { text: trimmedInput } });
    setInput('');
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, maxWidth: 800, margin: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 12, textAlign: 'center', flexShrink: 0 }}>
        <strong>Status:</strong> {connected ? <span style={{color: 'green'}}>Connected</span> : <span style={{color: 'red'}}>Disconnected</span>}
      </div>
      <div style={{ flexGrow: 1, overflowY: 'auto', marginBottom: 12, background: '#f9f9f9', padding: 8, border: '1px solid #eee', borderRadius: '4px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start', margin: '4px 0' }}>
            <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: 16, background: msg.from === 'user' ? '#d1e7dd' : '#e2e3e5', maxWidth: '80%', wordBreak: 'break-word' }}>
              {msg.text.split('\n').map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  {index < msg.text.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexShrink: 0 }}>
        <input
          style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: '4px' }}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={!connected}
        />
        <button style={{ marginLeft: 8, padding: '8px 12px', cursor: connected ? 'pointer' : 'not-allowed', opacity: connected ? 1 : 0.6 }} onClick={handleSend} disabled={!connected}>
          Send
        </button>
      </div>
    </div>
  );
} 