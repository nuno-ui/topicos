'use client';
import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Brain, Sparkles, BarChart3, Loader2, X, Clock, CheckCircle2 } from 'lucide-react';

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) !== 1 ? 's' : ''} ago`;
}

const MIN_INTERVAL_MS = 30_000; // 30 seconds rate limit between runs of same agent

export function DashboardAgents() {
  const [loading, setLoading] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; description: string; area: string; reason: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastRun, setLastRun] = useState<Record<string, Date>>({});
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const completedTimerRef = useRef<NodeJS.Timeout | null>(null);

  const runAgent = useCallback(async (agent: string) => {
    // Rate-limit: prevent running the same agent within 30s
    const last = lastRun[agent];
    if (last && Date.now() - last.getTime() < MIN_INTERVAL_MS) {
      toast.info(`Please wait ${Math.ceil((MIN_INTERVAL_MS - (Date.now() - last.getTime())) / 1000)}s before running again`);
      return;
    }

    setLoading(agent);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, context: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Agent failed');

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
      setLastRun(prev => ({ ...prev, [agent]: new Date() }));

      // Flash success indicator
      setJustCompleted(agent);
      if (completedTimerRef.current) clearTimeout(completedTimerRef.current);
      completedTimerRef.current = setTimeout(() => setJustCompleted(null), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Agent failed');
    }
    setLoading(null);
  }, [lastRun]);

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

  const agents = [
    {
      id: 'daily_briefing',
      label: 'Daily Briefing',
      desc: 'Get an AI summary of your day',
      icon: Brain,
      colors: 'bg-gradient-to-br from-purple-50 to-indigo-50 text-purple-700 border-purple-200 hover:from-purple-100 hover:to-indigo-100',
      iconBg: 'bg-purple-100',
    },
    {
      id: 'suggest_topics',
      label: 'Suggest Topics',
      desc: 'AI-generated topic ideas',
      icon: Sparkles,
      colors: 'bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-700 border-blue-200 hover:from-blue-100 hover:to-cyan-100',
      iconBg: 'bg-blue-100',
    },
    {
      id: 'weekly_review',
      label: 'Weekly Review',
      desc: 'Reflect on your week',
      icon: BarChart3,
      colors: 'bg-gradient-to-br from-green-50 to-emerald-50 text-green-700 border-green-200 hover:from-green-100 hover:to-emerald-100',
      iconBg: 'bg-green-100',
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Agent Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {agents.map((agent) => {
          const isRunning = loading === agent.id;
          const isDisabled = !!loading && !isRunning;
          const ran = lastRun[agent.id];
          return (
            <button key={agent.id} onClick={() => runAgent(agent.id)} disabled={!!loading}
              className={`relative p-5 rounded-xl border bg-white text-left transition-all shadow-sm hover:shadow-md group ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover-lift'} ${isRunning ? 'ring-2 ring-offset-1 ring-blue-300' : ''} ${justCompleted === agent.id ? 'ring-2 ring-offset-1 ring-green-300' : ''}`}>
              {justCompleted === agent.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center animate-scale-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                </div>
              )}
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${agent.iconBg} ${!isDisabled ? 'group-hover:scale-105' : ''}`}>
                  {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <agent.icon className="w-4 h-4" />}
                </div>
                <div>
                  <span className="font-semibold text-sm text-gray-900">{agent.label}</span>
                  {isRunning && <span className="ml-2 text-[10px] text-blue-500 font-medium animate-pulse">Running...</span>}
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2">{agent.desc}</p>
              {ran && (
                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>Last run: {timeAgo(ran)}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Daily Briefing */}
      {showBriefing && briefing && (
        <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 shadow-sm animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
              <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                <Brain className="w-3.5 h-3.5" />
              </div>
              Daily Briefing
            </h3>
            <button onClick={() => setShowBriefing(false)} className="p-1 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm max-w-none">{renderMarkdown(briefing)}</div>
        </div>
      )}

      {/* Weekly Review */}
      {showReview && review && (
        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5" />
              </div>
              Weekly Review
            </h3>
            <button onClick={() => setShowReview(false)} className="p-1 text-green-400 hover:text-green-600 hover:bg-green-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm max-w-none">{renderMarkdown(review)}</div>
        </div>
      )}

      {/* Topic Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 shadow-sm animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              Suggested Topics
            </h3>
            <button onClick={() => setShowSuggestions(false)} className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-blue-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                  <p className="text-xs text-blue-600 mt-1 italic">{s.reason}</p>
                </div>
                <button onClick={() => createSuggestedTopic(s)}
                  className="px-3 py-1.5 brand-gradient text-white rounded-lg text-xs font-medium hover:opacity-90 transition-all flex-shrink-0 shadow-sm">
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
