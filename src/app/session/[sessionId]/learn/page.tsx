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

export default function LearnPage() {
  const { sessionId } = useParams() as { sessionId?: string };
  const focus = useSessionStore((s) => s.focusObjective);
  const setFocus = useSessionStore((s) => s.setFocusObjective);
  const contentType = useSessionStore((s) => s.currentContentType);
  const contentData = useSessionStore((s) => s.currentInteractionContent);
  const sendInteractionAction = useSessionStore((s) => s.sendInteraction);

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

  if (loadingPlan) return <p>Loading lesson plan…</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;
  if (!focus) return <p>No focus yet.</p>;
  if (!contentType) return <p>Preparing lesson…</p>;

  // 3) Render based on response type
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
} 