'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { generatePlan } from '@/lib/api';
import { useSessionStore } from '@/store/sessionStore';
import {
  ExplanationView,
  QuestionView,
  FeedbackView,
  MessageView,
} from '@/components/OrchestratorViews';
import type {
  FocusObjective,
  ExplanationResponse,
  QuestionResponse,
  FeedbackResponse,
  MessageResponse,
  ErrorResponse,
} from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTutorStream } from '../../../../../lib/useTutorStream';

export default function LearnPage() {
  const { sessionId } = useParams() as { sessionId?: string };
  const focus = useSessionStore((s) => s.focusObjective);
  const setFocus = useSessionStore((s) => s.setFocusObjective);
  const contentType = useSessionStore((s) => s.currentContentType);
  const contentData = useSessionStore((s) => s.currentInteractionContent);
  const sendInteractionAction = useSessionStore((s) => s.sendInteraction);
  const { session } = useAuth();
  const jwt = session?.access_token || '';
  const { send, latency, agentTurn } = useTutorStream(sessionId || '', jwt);
  const conceptMastery = useSessionStore((s) => s.conceptMastery);

  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) Load focus plan once
  useEffect(() => {
    if (sessionId && !focus) {
      setLoadingPlan(true);
      generatePlan(sessionId)
        .then((plan) => setFocus(plan as FocusObjective))
        .catch((err) => setError(err.message || 'Failed to load plan'))
        .finally(() => setLoadingPlan(false));
    }
  }, [sessionId, focus, setFocus]);

  // 2) Kick-off first interaction
  useEffect(() => {
    if (focus && !contentType) {
      sendInteractionAction('start').catch((err) => setError(err.message || 'Start failed'));
    }
  }, [focus, contentType, sendInteractionAction]);

  // Layout: main content + sidebar
  return (
    <>
      <div className="flex">
        <div className="flex-1">
          {loadingPlan ? (
            <p>Loading lesson plan…</p>
          ) : error ? (
            <p className="text-red-600">Error: {error}</p>
          ) : !focus ? (
            <p>No focus yet.</p>
          ) : !contentType ? (
            <p>Preparing lesson…</p>
          ) : (
            (() => {
              switch (contentType) {
                case 'explanation':
                  return (
                    <ExplanationView
                      text={(contentData as ExplanationResponse).text}
                      onNext={() => sendInteractionAction('next')}
                    />
                  );
                case 'question':
                  return (
                    <QuestionView
                      question={(contentData as QuestionResponse).question}
                      onAnswer={(idx) => sendInteractionAction('answer', { answer_index: idx })}
                    />
                  );
                case 'feedback':
                  return (
                    <FeedbackView
                      feedback={(contentData as FeedbackResponse).feedback}
                      onNext={() => sendInteractionAction('next')}
                    />
                  );
                case 'message':
                  return <MessageView text={(contentData as MessageResponse).text} />;
                case 'error':
                  return <p className="text-red-600">Error: {(contentData as ErrorResponse).message}</p>;
                default:
                  return <p>Unknown response type: {contentType}</p>;
              }
            })()
          )}
        </div>
        <aside className="w-64 p-4 border-l bg-gray-50">
          <h3 className="font-semibold mb-2">Concept Mastery</h3>
          {Object.entries(conceptMastery).map(([concept, m]) => (
            <div key={concept} className="mb-4">
              <span className="block text-sm text-gray-700">{concept}</span>
              <MasteryBar value={m.mastery_level} />
            </div>
          ))}
          <h3 className="font-semibold mt-6 mb-2">Pace</h3>
          <PaceSlider onChange={(value: number) => send({ event_type: 'pace_change', value })} />
        </aside>
      </div>
      {/* Debug Overlay */}
      <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, background: 'rgba(30,41,59,0.85)', color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div>WS Latency: {latency !== null ? `${latency} ms` : '—'}</div>
        <div>Agent Turn: {agentTurn || '—'}</div>
      </div>
    </>
  );
}

// Stub MasteryBar component
function MasteryBar({ value }: { value: number }) {
  const percent = Math.min(Math.max(value * 100, 0), 100);
  return (
    <div className="w-full bg-gray-200 h-2 rounded">
      <div className="bg-green-500 h-2 rounded" style={{ width: `${percent}%` }} />
    </div>
  );
}

// Stub PaceSlider component
function PaceSlider({ onChange }: { onChange: (value: number) => void }) {
  const [value, setValue] = useState<number>(1);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setValue(v);
    onChange(v);
  };
  return (
    <input
      type="range"
      min="0.5"
      max="2"
      step="0.1"
      value={value}
      onChange={handleChange}
      className="w-full"
    />
  );
} 