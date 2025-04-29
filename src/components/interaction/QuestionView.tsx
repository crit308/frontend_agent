import React from 'react';
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { QuestionResponse } from '@/lib/types'; // Use existing type

interface QuestionViewProps {
  question: QuestionResponse; // Update type
  onAnswer: (selectedIndex: number) => void;
}

const QuestionView: React.FC<QuestionViewProps> = ({ question, onAnswer }) => {
  const [selectedValue, setSelectedValue] = React.useState<string | undefined>(undefined);

  const handleAnswer = () => {
    if (selectedValue !== undefined) {
      onAnswer(parseInt(selectedValue, 10));
    }
  };

  // Generate unique IDs for radio items for accessibility
  const getRadioItemId = (index: number) => `q-option-${index}`;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Question</h2>
      <p>{question.question.question}</p>
      <RadioGroup
        value={selectedValue}
        onValueChange={setSelectedValue}
        className="space-y-2"
      >
        {question.question.options.map((option: string, index: number) => (
          <div key={index} className="flex items-center space-x-2">
            <RadioGroupItem value={String(index)} id={getRadioItemId(index)} />
            <Label htmlFor={getRadioItemId(index)}>{option}</Label>
          </div>
        ))}
      </RadioGroup>
      <Button onClick={handleAnswer} disabled={selectedValue === undefined}>
        Submit Answer
      </Button>
    </div>
  );
};

export default QuestionView; 