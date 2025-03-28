'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LessonContent, SectionContent as SectionContentType, ExplanationContent as ExplanationContentType } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MiniQuiz from './MiniQuiz';
import UserSummary from './UserSummary';

interface LessonDisplayProps {
  lessonContent: LessonContent;
}

const LessonDisplay: React.FC<LessonDisplayProps> = ({ lessonContent }) => {

  const renderExplanation = (explanation: ExplanationContentType, sectionTitle: string) => (
    <div key={explanation.topic} className="my-4 p-4 border rounded bg-card">
      <h4 className="font-semibold text-lg mb-2">{explanation.topic}</h4>
      <div className="prose dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation.explanation}</ReactMarkdown>
      </div>
      {explanation.examples && explanation.examples.length > 0 && (
        <div className="mt-3">
          <p className="font-medium text-sm">Examples:</p>
          <ul className="list-disc list-inside text-sm ml-4">
            {explanation.examples.map((ex, i) => <li key={i}>{ex}</li>)}
          </ul>
        </div>
      )}
      {explanation.mini_quiz && explanation.mini_quiz.map((mq, index) => (
        <MiniQuiz key={index} question={mq} />
      ))}
      <UserSummary sectionTitle={sectionTitle} topic={explanation.topic} />
    </div>
  );

  const renderSection = (section: SectionContentType, index: number) => (
    <AccordionItem value={`section-${index}`} key={`section-${index}`}>
      <AccordionTrigger className="text-xl font-bold">
        Section {index + 1}: {section.title}
      </AccordionTrigger>
      <AccordionContent className="px-2">
        <Card className="mb-4 border-none shadow-none">
          <CardHeader className="pb-2">
            <CardDescription>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.introduction}</ReactMarkdown>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {section.explanations?.map((exp) => renderExplanation(exp, section.title))}

            {section.exercises && section.exercises.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold text-lg mb-2">Exercises</h4>
                {section.exercises.map((ex, i) => (
                  <Card key={i} className="mb-3 p-3 bg-secondary/30">
                    <p><strong>{i + 1}. ({ex.difficulty_level})</strong> {ex.question}</p>
                  </Card>
                ))}
              </div>
            )}

            <div className="mt-6 p-3 border-t">
              <h4 className="font-semibold text-md mb-1">Section Summary</h4>
              <p className="text-sm text-muted-foreground">{section.summary}</p>
            </div>
          </CardContent>
        </Card>
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{lessonContent.title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Introduction</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{lessonContent.introduction}</ReactMarkdown>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full">
        {lessonContent.sections?.map(renderSection)}
      </Accordion>

      <Card>
        <CardHeader>
          <CardTitle>Conclusion</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2">{lessonContent.conclusion}</p>
          {lessonContent.next_steps && lessonContent.next_steps.length > 0 && (
            <>
              <p className="font-medium mt-4">Suggested Next Steps:</p>
              <ul className="list-disc list-inside text-sm ml-4">
                {lessonContent.next_steps.map((step, i) => <li key={i}>{step}</li>)}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LessonDisplay; 