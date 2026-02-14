'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ClipboardPaste,
  Loader2,
  Tag,
  Users,
  Calendar,
  CheckSquare,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';

const AREA_COLORS: Record<string, string> = {
  personal: 'bg-area-personal/10 text-area-personal border-area-personal/20',
  career: 'bg-area-career/10 text-area-career border-area-career/20',
  work: 'bg-area-work/10 text-area-work border-area-work/20',
};

interface PasteAnalysis {
  detected_area: string;
  area_confidence: number;
  matched_topics: { topic_id: string | null; proposed_title: string | null; confidence: number; reason: string }[];
  extracted_tasks: { title: string; due_date: string | null; priority: string }[];
  extracted_people: { name: string; role?: string }[];
  extracted_deadlines: { date: string; description: string }[];
  suggested_summary_updates: { topic_id: string; update: string }[];
  suggested_deliverables: { kind: string; description: string }[];
}

export function PasteIn() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<PasteAnalysis | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch('/api/ai/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ClipboardPaste className="h-5 w-5 text-primary" />
          Paste-In
        </h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <>
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste anything here — meeting notes, email text, a plan, random notes... The AI will analyze it and connect it to your topics."
              className="h-32 w-full resize-none rounded-lg border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {text.length > 0 ? `${text.length} characters` : ''}
              </span>
              <button
                onClick={handleAnalyze}
                disabled={!text.trim() || loading}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardPaste className="h-4 w-4" />
                )}
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {analysis && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              {/* Detected Area */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Detected area:</span>
                <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium', AREA_COLORS[analysis.detected_area])}>
                  {analysis.detected_area}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({Math.round(analysis.area_confidence * 100)}% confidence)
                </span>
              </div>

              {/* Matched Topics */}
              {analysis.matched_topics.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Tag className="h-4 w-4" />
                    Matched Topics
                  </h3>
                  {analysis.matched_topics.map((topic, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-accent p-2">
                      <div>
                        <span className="text-sm font-medium">
                          {topic.proposed_title || 'Existing topic'}
                        </span>
                        <p className="text-xs text-muted-foreground">{topic.reason}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(topic.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Extracted Tasks */}
              {analysis.extracted_tasks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <CheckSquare className="h-4 w-4" />
                    Extracted Tasks
                  </h3>
                  {analysis.extracted_tasks.map((task, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-accent p-2">
                      <span className="text-sm">{task.title}</span>
                      <div className="flex items-center gap-2">
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">{task.due_date}</span>
                        )}
                        <span className={cn(
                          'rounded px-1.5 py-0.5 text-xs',
                          task.priority === 'high' ? 'bg-destructive/10 text-destructive' :
                          task.priority === 'medium' ? 'bg-warning/10 text-warning' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* People */}
              {analysis.extracted_people.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4" />
                    People
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.extracted_people.map((person, i) => (
                      <span key={i} className="rounded-full bg-accent px-3 py-1 text-xs">
                        {person.name}
                        {person.role && <span className="text-muted-foreground"> ({person.role})</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Deadlines */}
              {analysis.extracted_deadlines.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4" />
                    Deadlines
                  </h3>
                  {analysis.extracted_deadlines.map((dl, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-accent p-2">
                      <span className="text-sm">{dl.description}</span>
                      <span className="text-xs text-warning">{dl.date}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggested Deliverables */}
              {analysis.suggested_deliverables.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    Suggested Next
                  </h3>
                  {analysis.suggested_deliverables.map((del, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-accent p-2">
                      <span className="text-sm">{del.description}</span>
                      <span className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        {del.kind}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
