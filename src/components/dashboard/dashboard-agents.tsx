'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Brain, Sparkles, BarChart3, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';

export function DashboardAgents() {
  const [loading, setLoading] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; description: string; area: string; reason: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const runAgent = async (agent: string) => {
    setLoading(agent);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, context: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      switch (agent) {
        case 'daily_briefing':
          setBriefing(data.result.briefing);
          setShowBriefing(true);
          toast.success('Daily briefing generated');
          break;
        case 'suggest_topics':
          setSuggestions(data.result.suggestions || []);
          setShowSuggestions(true);
          toast.success(`${data.result.suggestions?.length || 0} topic suggestions`);
          break;
        case 'weekly_review':
          setReview(data.result.review);
          setShowReview(true);
          toast.success('Weekly review generated');
          break;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Agent failed');
    }
    setLoading(null);
  };

  const createSuggestedTopic = async (s: { title: string; description: string; area: string }) => {
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: s.title, description: s.description, area: s.area }),
      });
      if (!res.ok) throw new Error('Failed');
      setSuggestions(prev => prev.filter(p => p.title !== s.title));
      toast.success(`Created "${s.title}"`);
    } catch {
      toast.error('Failed to create topic');
    }
  };

  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-gray-900 mt-3 mb-1 text-sm">{line.replace('## ', '')}</h3>;
      if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-gray-900 mt-2 mb-1 text-base">{line.replace('# ', '')}</h2>;
      if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-sm text-gray-700 mt-0.5">{line.slice(2)}</li>;
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-gray-800 mt-2 text-sm">{line.replace(/\*\*/g, '')}</p>;
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="text-sm text-gray-700 mt-1">{line}</p>;
    });
  };

  return (
    <div className="space-y-4">
      {/* Agent Buttons */}
      <div className="p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-500" />
          AI Assistants
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => runAgent('daily_briefing')} disabled={!!loading}
            className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5">
            {loading === 'daily_briefing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            Daily Briefing
          </button>
          <button onClick={() => runAgent('suggest_topics')} disabled={!!loading}
            className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1.5">
            {loading === 'suggest_topics' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Suggest Topics
          </button>
          <button onClick={() => runAgent('weekly_review')} disabled={!!loading}
            className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50 flex items-center gap-1.5">
            {loading === 'weekly_review' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            Weekly Review
          </button>
        </div>
      </div>

      {/* Daily Briefing */}
      {showBriefing && briefing && (
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
              <Brain className="w-4 h-4" /> Daily Briefing
            </h3>
            <button onClick={() => setShowBriefing(false)} className="p-1 text-purple-400 hover:text-purple-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm max-w-none">{renderMarkdown(briefing)}</div>
        </div>
      )}

      {/* Weekly Review */}
      {showReview && review && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Weekly Review
            </h3>
            <button onClick={() => setShowReview(false)} className="p-1 text-green-400 hover:text-green-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm max-w-none">{renderMarkdown(review)}</div>
        </div>
      )}

      {/* Topic Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Suggested Topics
            </h3>
            <button onClick={() => setShowSuggestions(false)} className="p-1 text-blue-400 hover:text-blue-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-blue-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                  <p className="text-xs text-blue-600 mt-1 italic">{s.reason}</p>
                </div>
                <button onClick={() => createSuggestedTopic(s)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 flex-shrink-0">
                  Create
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
