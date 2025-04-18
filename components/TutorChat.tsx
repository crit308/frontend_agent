import React, { useState, useRef } from 'react';
import { useTutorStream } from '../lib/useTutorStream';
import { nanoid } from 'nanoid';

interface Message {
  id: string;
  text: string;
  from: 'user' | 'tutor';
}

export default function TutorChat({ sessionId, jwt }: { sessionId: string; jwt: string }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const tutorMsgIdRef = useRef<string | null>(null);

  const { connected, send } = useTutorStream(sessionId, jwt, {
    onOpen: () => console.log('[TutorChat] WS connected'),
    onRawResponse: (delta) => {
      setMessages(prev => {
        // if first delta, push new tutor message
        if (tutorMsgIdRef.current === null) {
          const id = nanoid();
          tutorMsgIdRef.current = id;
          return [...prev, { id, text: delta, from: 'tutor' }];
        }
        // otherwise append to existing tutor message
        return prev.map(msg =>
          msg.id === tutorMsgIdRef.current ? { ...msg, text: msg.text + delta } : msg
        );
      });
    },
    onError: (err) => console.error('[TutorChat] error', err),
    onClose: () => console.log('[TutorChat] WS closed'),
    onUnhandled: (evt) => console.warn('[TutorChat] unhandled event', evt),
  });

  const handleSend = () => {
    if (!input.trim()) return;
    // push user message
    setMessages(prev => [...prev, { id: nanoid(), text: input, from: 'user' }]);
    // reset tutor message tracking
    tutorMsgIdRef.current = null;
    // send to WS
    send({ question: input });
    setInput('');
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, maxWidth: 600 }}>
      <div style={{ marginBottom: 12 }}>
        <strong>Status:</strong> {connected ? 'Connected' : 'Disconnected'}
      </div>
      <div style={{ height: 300, overflowY: 'auto', marginBottom: 12, background: '#f9f9f9', padding: 8 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ textAlign: msg.from === 'user' ? 'right' : 'left', margin: '4px 0' }}>
            <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: 16, background: msg.from === 'user' ? '#d1e7dd' : '#e2e3e5' }}>
              {msg.text}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex' }}>
        <input
          style={{ flex: 1, padding: 8 }}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your question..."
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button style={{ marginLeft: 8 }} onClick={handleSend} disabled={!connected}>
          Send
        </button>
      </div>
    </div>
  );
} 