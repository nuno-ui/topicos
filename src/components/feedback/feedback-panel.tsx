'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Loader2, Bug, Lightbulb, Rocket, Download, Filter,
  ChevronDown, ChevronUp, MessageSquarePlus, Tag, Gauge,
  Wrench, Calendar, ExternalLink, BarChart3,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIAnalysis {
  category?: string;
  priority?: string;
  technical_summary?: string;
  suggested_fix?: string;
}

interface FeedbackItem {
  id: string;
  type: 'bug' | 'improvement' | 'idea';
  title: string;
  description: string;
  page: string | null;
  status: 'new' | 'reviewed' | 'implemented' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  ai_analysis: AIAnalysis | null;
  created_at: string;
  updated_at: string;
}

type FilterType = 'all' | 'bug' | 'improvement' | 'idea';
type FilterStatus = 'all' | 'new' | 'reviewed' | 'implemented' | 'dismissed';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, typeof Bug> = {
  bug: Bug,
  improvement: Lightbulb,
  idea: Rocket,
};

const TYPE_COLORS: Record<string, string> = {
  bug: 'text-red-600 bg-red-50 border-red-200',
  improvement: 'text-amber-600 bg-amber-50 border-amber-200',
  idea: 'text-blue-600 bg-blue-50 border-blue-200',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'text-blue-700 bg-blue-50 border-blue-200',
  reviewed: 'text-purple-700 bg-purple-50 border-purple-200',
  implemented: 'text-green-700 bg-green-50 border-green-200',
  dismissed: 'text-gray-500 bg-gray-50 border-gray-200',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-700 bg-red-50 border-red-200',
  high: 'text-orange-700 bg-orange-50 border-orange-200',
  medium: 'text-amber-700 bg-amber-50 border-amber-200',
  low: 'text-green-700 bg-green-50 border-green-200',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeedbackPanel() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch feedback
  const fetchFeedback = useCallback(async () => {
    try {
      const res = await fetch('/api/feedback');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Gracefully handle missing feedback table (migration not run)
      if (data.table_missing) {
        setFeedback([]);
        setLoading(false);
        return;
      }
      setFeedback(data.feedback ?? []);
    } catch (err) {
      // Don't show error toast for expected "table missing" scenario
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('schema cache') && !msg.includes('does not exist')) {
        toast.error(msg || 'Failed to load feedback');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  // Export handler
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/feedback/export');
      if (!res.ok) throw new Error('Export failed');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `youos-feedback-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Feedback exported for Claude Code');
    } catch {
      toast.error('Export failed');
    }
    setExporting(false);
  };

  // Filtered items
  const filteredFeedback = feedback.filter(f => {
    if (filterType !== 'all' && f.type !== filterType) return false;
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    return true;
  });

  // Stats
  const stats = {
    total: feedback.length,
    bugs: feedback.filter(f => f.type === 'bug').length,
    improvements: feedback.filter(f => f.type === 'improvement').length,
    ideas: feedback.filter(f => f.type === 'idea').length,
    newCount: feedback.filter(f => f.status === 'new').length,
    reviewed: feedback.filter(f => f.status === 'reviewed').length,
    implemented: feedback.filter(f => f.status === 'implemented').length,
  };

  // Format date
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading feedback...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {feedback.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-3.5 text-center border border-gray-100 hover:shadow-sm transition-shadow">
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Total</p>
          </div>
          <div className="bg-white rounded-xl p-3.5 text-center border border-red-100 hover:shadow-sm transition-shadow">
            <p className="text-2xl font-bold text-red-600">{stats.bugs}</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Bugs</p>
          </div>
          <div className="bg-white rounded-xl p-3.5 text-center border border-amber-100 hover:shadow-sm transition-shadow">
            <p className="text-2xl font-bold text-amber-600">{stats.improvements}</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Improvements</p>
          </div>
          <div className="bg-white rounded-xl p-3.5 text-center border border-blue-100 hover:shadow-sm transition-shadow">
            <p className="text-2xl font-bold text-blue-600">{stats.ideas}</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Ideas</p>
          </div>
        </div>
      )}

      {/* Filters + Export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as FilterType)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="all">All types</option>
            <option value="bug">Bugs</option>
            <option value="improvement">Improvements</option>
            <option value="idea">Ideas</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as FilterStatus)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="implemented">Implemented</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>

        {feedback.length > 0 && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Export for Claude Code
          </button>
        )}
      </div>

      {/* Feedback list */}
      {filteredFeedback.length === 0 ? (
        <div className="p-8 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 text-center">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-3">
            <MessageSquarePlus className="w-6 h-6 text-purple-500" />
          </div>
          <p className="text-sm font-medium text-gray-700">
            {feedback.length === 0 ? 'No feedback yet' : 'No feedback matches your filters'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {feedback.length === 0
              ? 'Use the feedback button in the bottom-right corner to report bugs or suggest improvements'
              : 'Try adjusting your filter criteria'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFeedback.map(item => {
            const TypeIcon = TYPE_ICONS[item.type] || Bug;
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Main row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full flex items-start gap-3 p-4 text-left"
                >
                  {/* Type icon */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${TYPE_COLORS[item.type]}`}>
                    <TypeIcon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[item.status]}`}>
                        {item.status}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[item.priority]}`}>
                        {item.priority}
                      </span>
                      {item.ai_analysis?.category && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-purple-200 text-purple-700 bg-purple-50">
                          {item.ai_analysis.category}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Expand chevron */}
                  <div className="flex-shrink-0 pt-1">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-100 space-y-3 animate-fade-in">
                    {/* Full description */}
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.description}</p>
                    </div>

                    {/* Page */}
                    {item.page && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <ExternalLink className="w-3 h-3" />
                        Page: {item.page}
                      </div>
                    )}

                    {/* AI Analysis */}
                    {item.ai_analysis && (
                      <div className="p-3.5 bg-gradient-to-br from-purple-50/80 to-blue-50/50 rounded-xl border border-purple-100">
                        <p className="text-xs font-semibold text-purple-800 mb-2.5 flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5" />
                          AI Analysis
                        </p>
                        <div className="space-y-2">
                          {item.ai_analysis.category && (
                            <div className="flex items-center gap-2">
                              <Tag className="w-3 h-3 text-purple-500 flex-shrink-0" />
                              <span className="text-xs text-gray-600">Category:</span>
                              <span className="text-xs font-medium text-gray-900">{item.ai_analysis.category}</span>
                            </div>
                          )}
                          {item.ai_analysis.priority && (
                            <div className="flex items-center gap-2">
                              <Gauge className="w-3 h-3 text-orange-500 flex-shrink-0" />
                              <span className="text-xs text-gray-600">AI Priority:</span>
                              <span className="text-xs font-medium text-gray-900">{item.ai_analysis.priority}</span>
                            </div>
                          )}
                          {item.ai_analysis.technical_summary && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-0.5">Technical Summary</p>
                              <p className="text-xs text-gray-700 leading-relaxed">{item.ai_analysis.technical_summary}</p>
                            </div>
                          )}
                          {item.ai_analysis.suggested_fix && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Wrench className="w-3 h-3 text-blue-500" />
                                <p className="text-xs text-gray-500 font-medium">Suggested Approach</p>
                              </div>
                              <p className="text-xs text-gray-700 leading-relaxed">{item.ai_analysis.suggested_fix}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
