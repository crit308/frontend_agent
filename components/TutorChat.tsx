import React, { useState, useRef, useEffect } from 'react';
import { useTutorStream } from '../lib/useTutorStream';
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

  const { connected, send } = useTutorStream(sessionId, jwt, {
    onOpen: () => {
        console.log('[TutorChat] WS connected');
    },
    onRawResponse: (delta) => {
        currentTutorMessage.current += delta;
        setMessages(prev => {
            if (tutorMsgIdRef.current === null) {
                 const id = nanoid();
                 tutorMsgIdRef.current = id;
                 return [...prev, { id, text: delta, from: 'tutor' }];
            }
            return prev.map(msg =>
                 msg.id === tutorMsgIdRef.current
                 ? { ...msg, text: currentTutorMessage.current }
                 : msg
            );
        });
    },
    onInteractionResponse: (response) => {
        console.log("[TutorChat] Received structured response:", response);
        if (response?.data?.response_type === 'message' || response?.data?.response_type === 'explanation') {
            const existingMsg = messages.find(m => m.id === tutorMsgIdRef.current);
            if (!existingMsg || existingMsg.text !== response.data.text) {
                 const newMsg = { id: tutorMsgIdRef.current || nanoid(), text: response.data.text, from: 'tutor' as const };
                 setMessages(prev => {
                      const filtered = prev.filter(m => m.id !== newMsg.id);
                      return [...filtered, newMsg];
                 });
            }
        }
        tutorMsgIdRef.current = null;
        currentTutorMessage.current = '';
    },
    onError: (err) => {
        console.error('[TutorChat] error', err);
        setMessages(prev => [...prev, { id: nanoid(), text: `Error: ${err?.message || 'Connection issue'}`, from: 'tutor'}]);
    },
    onClose: () => {
        console.log('[TutorChat] WS closed');
    },
    onUnhandled: (evt) => {
         console.warn('[TutorChat] unhandled event', evt);
         if (evt?.type === 'unknown_event' && typeof evt.content === 'string') {
         }
    },
  });

  const handleSend = () => {
    if (!input.trim() || !connected) return;
    const userMsg = { id: nanoid(), text: input, from: 'user' as const };
    setMessages(prev => [...prev, userMsg]);
    tutorMsgIdRef.current = null;
    currentTutorMessage.current = '';
    send({ type: 'user_message', data: { text: input } });
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
              {msg.text}
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