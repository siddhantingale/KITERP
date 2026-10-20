import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";

export default function QuizBuilder({ questions, onQuestionsChange }) {
  const addQuestion = () => {
    const newQuestion = {
      id: Date.now(),
      question_text: "",
      question_type: "MCQ",
      marks: 1,
      options: ["", "", "", ""],
      correct_answer: "",
      order: questions.length + 1
    };
    onQuestionsChange([...questions, newQuestion]);
  };

  const updateQuestion = (id, field, value) => {
    const updated = questions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    );
    onQuestionsChange(updated);
  };

  const updateOption = (questionId, optionIndex, value) => {
    const updated = questions.map(q => {
      if (q.id === questionId) {
        const newOptions = [...q.options];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    });
    onQuestionsChange(updated);
  };

  const deleteQuestion = (id) => {
    onQuestionsChange(questions.filter(q => q.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Quiz Questions</h3>
        <Button onClick={addQuestion} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Question
        </Button>
      </div>

      {questions.map((question, index) => (
        <Card key={question.id} className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="w-5 h-5 text-gray-400" />
                <span className="font-semibold">Question {index + 1}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteQuestion(question.id)}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Question Text *</Label>
              <Textarea
                value={question.question_text}
                onChange={(e) => updateQuestion(question.id, 'question_text', e.target.value)}
                placeholder="Enter question..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Question Type *</Label>
                <Select 
                  value={question.question_type} 
                  onValueChange={(value) => updateQuestion(question.id, 'question_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MCQ">Multiple Choice (MCQ)</SelectItem>
                    <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Marks *</Label>
                <Input
                  type="number"
                  min="1"
                  value={question.marks}
                  onChange={(e) => updateQuestion(question.id, 'marks', parseInt(e.target.value))}
                />
              </div>
            </div>

            {question.question_type === "MCQ" && (
              <div className="space-y-3">
                <Label>Options *</Label>
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                    />
                  </div>
                ))}

                <div>
                  <Label>Correct Answer *</Label>
                  <Select 
                    value={question.correct_answer} 
                    onValueChange={(value) => updateQuestion(question.id, 'correct_answer', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select correct answer" />
                    </SelectTrigger>
                    <SelectContent>
                      {question.options.map((opt, idx) => (
                        <SelectItem key={idx} value={String(idx)}>
                          {String.fromCharCode(65 + idx)}: {opt || '(empty)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {question.question_type === "SHORT_ANSWER" && (
              <div>
                <Label>Expected Answer (for reference)</Label>
                <Textarea
                  value={question.correct_answer || ''}
                  onChange={(e) => updateQuestion(question.id, 'correct_answer', e.target.value)}
                  placeholder="Enter expected answer..."
                  rows={2}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Short answers will be manually graded by faculty
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {questions.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <p className="text-gray-500 mb-4">No questions added yet</p>
          <Button onClick={addQuestion} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add First Question
          </Button>
        </div>
      )}
    </div>
  );
}