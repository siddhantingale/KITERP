import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Clock, CheckCircle } from "lucide-react";

export default function QuizTaker({ questions, timeLimit, onSubmit, onCancel }) {
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(timeLimit ? timeLimit * 60 : null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!timeLimit) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLimit]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleAutoSubmit = () => {
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    await onSubmit(answers);
    setIsSubmitting(false);
  };

  const answeredCount = Object.keys(answers).filter(key => answers[key]).length;

  return (
    <div className="space-y-6">
      {timeLimit && (
        <Card className={`border-2 ${timeLeft < 60 ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span className="font-semibold">Time Remaining:</span>
              </div>
              <span className={`text-2xl font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-blue-600'}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-2 border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Progress: {answeredCount} / {questions.length} questions answered</span>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4" />
              <span>Total Marks: {questions.reduce((sum, q) => sum + q.marks, 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {questions.map((question, index) => (
        <Card key={question.id} className="border-2">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-lg mb-2">{question.question_text}</p>
                <span className="text-sm text-gray-600">({question.marks} mark{question.marks > 1 ? 's' : ''})</span>
              </div>
            </div>

            {question.question_type === "MCQ" && (
              <RadioGroup 
                value={answers[question.id] || ''} 
                onValueChange={(value) => handleAnswerChange(question.id, value)}
                className="space-y-2 ml-11"
              >
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value={String(optionIndex)} id={`q${question.id}-opt${optionIndex}`} />
                    <Label htmlFor={`q${question.id}-opt${optionIndex}`} className="flex-1 cursor-pointer">
                      <span className="font-semibold mr-2">{String.fromCharCode(65 + optionIndex)}.</span>
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {question.question_type === "SHORT_ANSWER" && (
              <Textarea
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Enter your answer..."
                rows={4}
                className="ml-11"
              />
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end gap-3 sticky bottom-6">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={answeredCount === 0 || isSubmitting}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
        </Button>
      </div>
    </div>
  );
}