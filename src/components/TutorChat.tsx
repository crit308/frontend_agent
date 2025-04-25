import React, { useState, useRef, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useSessionStore } from '@/store/sessionStore';
import type { ConnectionStatus } from '@/store/sessionStore';

interface Message {
  id: string;
  text: string;
  from: 'user' | 'tutor';
}

export default function TutorChat({ sessionId, jwt, connectionStatus }: { sessionId: string; jwt: string; connectionStatus: ConnectionStatus }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const sendInteraction = useSessionStore((state) => state.sendInteraction);

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || connectionStatus !== 'connected') return;

    const userMsg = { id: nanoid(), text: trimmedInput, from: 'user' as const };
    setMessages(prev => [...prev, userMsg]);

    sendInteraction('user_message', { text: trimmedInput });
    setInput('');
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, maxWidth: 800, margin: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
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
          disabled={connectionStatus !== 'connected'}
        />
        <button
          style={{ marginLeft: 8, padding: '8px 12px', cursor: connectionStatus === 'connected' ? 'pointer' : 'not-allowed', opacity: connectionStatus === 'connected' ? 1 : 0.6 }}
          onClick={handleSend}
          disabled={connectionStatus !== 'connected'}
        >
          Send
        </button>
      </div>
    </div>
  );
} 