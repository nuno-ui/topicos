'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  MessageSquarePlus, X, Loader2, Bug, Lightbulb, Rocket,
  ChevronRight, Tag, Gauge, Wrench,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeedbackType = 'bug' | 'improvement' | 'idea';

interface AIAnalysis {
  category?: string;
  priority?: string;
  technical_summary?: string;
  suggested_fix?: string;
}

interface FeedbackResponse {
  feedback: {
    id: string;
    type: string;
    title: string;
    description: string;
    priority: string;
    ai_analysis: AIAnalysis | null;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<FeedbackType, { label: string; icon: typeof Bug; color: string; bgColor: string; borderColor: string; placeholder: string }> = {
  bug: {
    label: 'Bug',
    icon: Bug,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    placeholder: 'Describe the bug: what happened, what you expected, and steps to reproduce...',
  },
  improvement: {
    label: 'Improvement',
    icon: Lightbulb,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    placeholder: 'Describe the improvement: what could work better and how you envision the change...',
  },
  idea: {
    label: 'Idea',
    icon: Rocket,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    placeholder: 'Describe your idea: what feature would you like and why it would be valuable...',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FeedbackResponse | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Focus the title input when the modal opens
  useEffect(() => {
    if (open && titleRef.current) {
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset form when modal closes
  const handleClose = () => {
    setOpen(false);
    // Delay reset so the close animation plays
    setTimeout(() => {
      setType('bug');
      setTitle('');
      setDescription('');
      setResult(null);
    }, 200);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in both the title and description');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          page: typeof window !== 'undefined' ? window.location.pathname : '',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit feedback');

      setResult(data as FeedbackResponse);
      toast.success('Feedback submitted successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit feedback');
    }
    setSubmitting(false);
  };

  const config = TYPE_CONFIG[type];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:scale-105 active:scale-95 group"
        title="Report bug or suggest improvement"
        aria-label="Open feedback form"
      >
        <MessageSquarePlus className="w-5 h-5 group-hover:rotate-12 transition-transform" />
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleClose}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50/80 to-blue-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                  <MessageSquarePlus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Send Feedback</h2>
                  <p className="text-xs text-gray-500">Report a bug or suggest an improvement</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            {!result ? (
              <div className="px-6 py-5 space-y-4">
                {/* Type selector */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-2 block">Type</label>
                  <div className="flex gap-2">
                    {(Object.keys(TYPE_CONFIG) as FeedbackType[]).map((t) => {
                      const cfg = TYPE_CONFIG[t];
                      const Icon = cfg.icon;
                      const isActive = type === t;
                      return (
                        <button
                          key={t}
                          onClick={() => setType(t)}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                            isActive
                              ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color} shadow-sm`
                              : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label htmlFor="feedback-title" className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Title
                  </label>
                  <input
                    ref={titleRef}
                    id="feedback-title"
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Brief summary..."
                    maxLength={255}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 bg-gray-50/50 placeholder-gray-400 transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="feedback-description" className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Description
                  </label>
                  <textarea
                    id="feedback-description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={config.placeholder}
                    rows={4}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 bg-gray-50/50 placeholder-gray-400 resize-none transition-all"
                  />
                </div>

                {/* Page info */}
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <ChevronRight className="w-3 h-3" />
                  Page: {typeof window !== 'undefined' ? window.location.pathname : '/'}
                </div>
              </div>
            ) : (
              /* AI analysis result */
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  Feedback submitted!
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">AI Analysis</p>

                  {result.feedback.ai_analysis ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-xs text-gray-600">Category:</span>
                        <span className="text-xs font-medium text-gray-900 bg-purple-50 px-2 py-0.5 rounded-full">
                          {result.feedback.ai_analysis.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Gauge className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-xs text-gray-600">Priority:</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getPriorityStyle(result.feedback.priority)}`}>
                          {result.feedback.priority}
                        </span>
                      </div>

                      {result.feedback.ai_analysis.technical_summary && (
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5 font-medium">Technical Summary</p>
                          <p className="text-xs text-gray-700 leading-relaxed">{result.feedback.ai_analysis.technical_summary}</p>
                        </div>
                      )}

                      {result.feedback.ai_analysis.suggested_fix && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Wrench className="w-3 h-3 text-blue-500" />
                            <p className="text-xs text-gray-500 font-medium">Suggested Approach</p>
                          </div>
                          <p className="text-xs text-gray-700 leading-relaxed">{result.feedback.ai_analysis.suggested_fix}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">AI analysis was not available for this item.</p>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
              {!result ? (
                <>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !title.trim() || !description.trim()}
                    className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                        Submit
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleClose}
                  className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPriorityStyle(priority: string): string {
  switch (priority) {
    case 'critical': return 'text-red-700 bg-red-50';
    case 'high': return 'text-orange-700 bg-orange-50';
    case 'medium': return 'text-amber-700 bg-amber-50';
    case 'low': return 'text-green-700 bg-green-50';
    default: return 'text-gray-700 bg-gray-50';
  }
}
