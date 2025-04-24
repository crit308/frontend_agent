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
  const contentData = useSessionStore((s) => s.currentInteractionContent);
  const sendInteractionAction = useSessionStore((s) => s.sendInteraction);
  const { session } = useAuth();
  const jwt = session?.access_token || '';
  const { send, latency, agentTurn } = useTutorStream(sessionId || '', jwt);

  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Debug Log ---
  console.log('[LearnPage] Rendering. contentData:', contentData);

  // 1) Load focus plan once - COMMENTED OUT: Assuming plan is now generated via WS 'start'
  /*
  useEffect(() => {
    if (sessionId && !focus) {
      setLoadingPlan(true);
      generatePlan(sessionId)
        .then((plan) => setFocus(plan as FocusObjective))
        .catch((err) => setError(err.message || 'Failed to load plan'))
        .finally(() => setLoadingPlan(false));
    }
  }, [sessionId, focus, setFocus]);
  */

  // 2) Kick-off first interaction - COMMENTED OUT: 'start' message now sent by useTutorStream hook onOpen
  /*
  useEffect(() => {
    if (focus && !contentData) {
      sendInteractionAction('start').catch((err) => setError(err.message || 'Start failed'));
    }
  }, [focus, contentData, sendInteractionAction]);
  */

  // Layout: main content + sidebar
  return (
    <>
      <div className="flex">
        <div className="flex-1">
          {loadingPlan ? (
            <p>Loading lesson plan…</p>
          ) : error ? (
            <p className="text-red-600">Error: {error}</p>
          ) : /* !focus ? ( // Focus is no longer loaded initially here
            <p>No focus yet.</p>
          ) : */ !contentData ? (
            <p>Connecting to tutor and preparing lesson…</p>
          ) : (
            (() => {
              const type = contentData?.response_type;
              if (!type) return <p>Waiting for tutor response...</p>;

              switch (type) {
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
                  return <p>Unknown response type: {type}</p>;
              }
            })()
          )}
        </div>
      </div>
      {/* Debug Overlay */}
      <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, background: 'rgba(30,41,59,0.85)', color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div>WS Latency: {latency !== null ? `${latency} ms` : '—'}</div>
        <div>Agent Turn: {agentTurn || '—'}</div>
      </div>
    </>
  );
} 