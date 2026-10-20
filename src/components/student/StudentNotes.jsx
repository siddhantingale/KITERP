import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BookOpen, Download, Search, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { jsPDF } from "jspdf";

export default function StudentNotes({ student }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');

  useEffect(() => {
    fetchNotes();
  }, [student]);

  const fetchNotes = async () => {
    try {
      const notesList = await api.entities.Note.filter({
        batch_id: student.batch_id
      }, '-created_date');
      
      // Use static notes if no data
      if (notesList.length === 0) {
        const staticNotes = [
          {
            id: '1',
            title: 'Machine Learning - Neural Networks',
            description: 'Comprehensive notes on neural network architectures, backpropagation, and activation functions.',
            subject: 'Machine Learning',
            file_type: 'PDF',
            file_url: '#',
            created_date: '2026-01-15',
            uploaded_by_name: 'Dr. Anil Kumar'
          },
          {
            id: '2',
            title: 'Data Structures - Trees and Graphs',
            description: 'Complete coverage of tree data structures including BST, AVL, and graph traversal algorithms.',
            subject: 'Data Structures',
            file_type: 'PDF',
            file_url: '#',
            created_date: '2026-01-14',
            uploaded_by_name: 'Prof. Priya Sharma'
          },
          {
            id: '3',
            title: 'DBMS - SQL Query Optimization',
            description: 'Advanced SQL queries, indexing strategies, and query optimization techniques.',
            subject: 'Database Management',
            file_type: 'PDF',
            file_url: '#',
            created_date: '2026-01-13',
            uploaded_by_name: 'Dr. Rajesh Patil'
          },
          {
            id: '4',
            title: 'Computer Networks - TCP/IP Protocol',
            description: 'Detailed notes on TCP/IP protocol suite, OSI model, and network security fundamentals.',
            subject: 'Computer Networks',
            file_type: 'PDF',
            file_url: '#',
            created_date: '2026-01-12',
            uploaded_by_name: 'Prof. Sneha Desai'
          },
          {
            id: '5',
            title: 'Operating Systems - Process Scheduling',
            description: 'Process management, CPU scheduling algorithms, and deadlock prevention strategies.',
            subject: 'Operating Systems',
            file_type: 'PDF',
            file_url: '#',
            created_date: '2026-01-11',
            uploaded_by_name: 'Dr. Amit Joshi'
          },
          {
            id: '6',
            title: 'ML - Python Libraries Reference',
            description: 'Quick reference guide for NumPy, Pandas, Scikit-learn, and TensorFlow.',
            subject: 'Machine Learning',
            file_type: 'Link',
            file_url: '#',
            created_date: '2026-01-10',
            uploaded_by_name: 'Dr. Anil Kumar'
          }
        ];
        setNotes(staticNotes);
      } else {
        setNotes(notesList);
      }
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
    setLoading(false);
  };

  const subjects = ['all', ...new Set(notes.map(n => n.subject))];

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          note.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || note.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  const getFileIcon = (type) => {
    if (type === 'Link') return ExternalLink;
    return FileText;
  };

  if (loading) {
    return <div className="h-64 bg-gray-200 rounded animate-pulse"></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">📚 Notes</h1>
        <p className="text-gray-600 mt-1">Access study materials</p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white"
        >
          {subjects.map(sub => (
            <option key={sub} value={sub}>{sub === 'all' ? 'All Subjects' : sub}</option>
          ))}
        </select>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNotes.map(note => {
          const Icon = getFileIcon(note.file_type);
          return (
            <Card key={note.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-start justify-between">
                  <Icon className="w-8 h-8 text-blue-600" />
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold">
                    {note.file_type}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-900 mb-2">{note.title}</h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{note.description}</p>
                <div className="space-y-2 text-xs text-gray-500">
                  <p><strong>Subject:</strong> {note.subject}</p>
                  <p><strong>Uploaded:</strong> {format(new Date(note.created_date), 'PP')}</p>
                  {note.uploaded_by_name && <p><strong>By:</strong> {note.uploaded_by_name}</p>}
                </div>
                <Button 
                  onClick={() => {
                    if (note.file_url && note.file_url !== '#') {
                      window.open(note.file_url, '_blank');
                    } else {
                      // Generate PDF for static notes
                      const doc = new jsPDF();
                      
                      // Header
                      doc.setFillColor(59, 130, 246);
                      doc.rect(0, 0, 210, 40, 'F');
                      doc.setTextColor(255, 255, 255);
                      doc.setFontSize(20);
                      doc.setFont(undefined, 'bold');
                      doc.text(note.title, 105, 18, { align: 'center' });
                      doc.setFontSize(12);
                      doc.setFont(undefined, 'normal');
                      doc.text(`Subject: ${note.subject}`, 105, 28, { align: 'center' });
                      doc.text(`By: ${note.uploaded_by_name}`, 105, 35, { align: 'center' });
                      
                      // Content
                      doc.setTextColor(0, 0, 0);
                      doc.setFontSize(14);
                      doc.setFont(undefined, 'bold');
                      doc.text('Description', 20, 55);
                      doc.setFontSize(11);
                      doc.setFont(undefined, 'normal');
                      const descLines = doc.splitTextToSize(note.description, 170);
                      doc.text(descLines, 20, 65);
                      
                      // Sample content based on subject
                      let sampleContent = '';
                      if (note.subject === 'Machine Learning') {
                        sampleContent = `
Machine Learning Notes

1. Introduction to Neural Networks
- Artificial neurons and perceptrons
- Activation functions (ReLU, Sigmoid, Tanh)
- Forward propagation
- Backpropagation algorithm

2. Deep Learning Architectures
- Convolutional Neural Networks (CNN)
- Recurrent Neural Networks (RNN)
- Long Short-Term Memory (LSTM)
- Transformers and Attention Mechanism

3. Training Techniques
- Gradient descent optimization
- Learning rate scheduling
- Regularization (L1, L2, Dropout)
- Batch normalization

4. Practical Applications
- Image classification
- Natural language processing
- Speech recognition
- Recommendation systems`;
                      } else if (note.subject === 'Data Structures') {
                        sampleContent = `
Data Structures Notes

1. Trees
- Binary Trees
- Binary Search Trees (BST)
- AVL Trees (Self-balancing)
- Red-Black Trees

2. Graphs
- Graph representation (Adjacency Matrix/List)
- BFS and DFS traversal
- Shortest path algorithms
- Minimum Spanning Tree

3. Tree Operations
- Insertion and Deletion
- Tree traversal (Inorder, Preorder, Postorder)
- Height and Depth calculation
- Balancing operations`;
                      } else {
                        sampleContent = `
${note.subject} Notes

This document contains comprehensive study material for ${note.subject}.

Topics Covered:
- Core concepts and fundamentals
- Important theories and principles
- Practical examples and applications
- Problem-solving techniques
- Exam preparation tips

For detailed content, please refer to the course materials provided by your instructor.`;
                      }
                      
                      doc.setFontSize(10);
                      const contentLines = doc.splitTextToSize(sampleContent, 170);
                      doc.text(contentLines, 20, 85);
                      
                      // Footer
                      doc.setFontSize(8);
                      doc.setTextColor(128, 128, 128);
                      doc.text(`Downloaded: ${new Date().toLocaleDateString()} | EDU TRACK`, 105, 285, { align: 'center' });
                      
                      doc.save(`${note.title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
                    }
                  }}
                  className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {note.file_type === 'Link' ? 'Open' : 'Download'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredNotes.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No notes found</p>
        </div>
      )}
    </div>
  );
}