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
import TutorChat from '@/../components/TutorChat';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function LearnPage() {
  const { sessionId } = useParams() as { sessionId?: string };
  const contentData = useSessionStore((s) => s.currentInteractionContent);
  const sendInteractionAction = useSessionStore((s) => s.sendInteraction);
  const loadingState = useSessionStore((s) => s.loadingState);
  const error = useSessionStore((s) => s.error);
  const { session, loading: authLoading } = useAuth();
  const jwt = session?.access_token || '';
  const { connected, latency, agentTurn } = useTutorStream(sessionId || '', jwt, {});

  // --- Debug Log ---
  console.log('[LearnPage] Rendering. contentData:', contentData, 'Connected:', connected, 'LoadingState:', loadingState, 'AuthLoading:', authLoading);

  if (authLoading || loadingState === 'loading') {
     return <LoadingSpinner message="Initializing Session..." />;
  }
  if (!sessionId || !jwt) {
     return <p>Error: Session ID or authentication token is missing.</p>;
  }
  if (error) {
      return <p className="text-red-600">Error: {error}</p>;
  }
  return (
    <>
      <div className="flex h-[calc(100vh-10rem)]">
        <div className="flex-1 flex flex-col">
           <TutorChat sessionId={sessionId} jwt={jwt} />
        </div>
      </div>
       <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, background: 'rgba(30,41,59,0.85)', color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
         <div>WS Status: {connected ? 'Connected' : 'Disconnected'}</div>
         <div>WS Latency: {latency !== null ? `${latency} ms` : '—'}</div>
       </div>
    </>
  );
} 