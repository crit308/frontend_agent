import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import type { ExplanationResponse } from '@/lib/types';

interface ExplanationViewProps {
  content: ExplanationResponse;
  onNext: () => void;
}

export function ExplanationViewComponent({ content, onNext }: ExplanationViewProps) {
  const explanationText = content.text;

  return (
    <div className="p-4 space-y-4 prose dark:prose-invert max-w-none">
      <h2 className="text-xl font-semibold">Explanation</h2>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanationText || ''}</ReactMarkdown>
      {!content.is_last_segment && (
        <Button onClick={onNext}>Next</Button>
      )}
    </div>
  );
}

export default ExplanationViewComponent; 