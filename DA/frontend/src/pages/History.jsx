import React, { useState, useEffect, useCallback } from 'react';
import { 
  History as HistoryIcon, 
  Clock, 
  ArrowRight, 
  MessageSquare, 
  Database, 
  Sparkles, 
  Trash2, 
  FileSpreadsheet, 
  RefreshCw, 
  CheckCircle2, 
  Layers, 
  ExternalLink 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkbook } from '../context/WorkbookContext';
import { getWorkspaceHistory, deleteWorkbookApi } from '../services/api';

export default function History() {
  const { workbookId, filename, switchWorkbook } = useWorkbook();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [scope, setScope] = useState('current'); // 'current' | 'all'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchHistory = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const targetWb = scope === 'current' ? workbookId : null;
      const res = await getWorkspaceHistory(targetWb);
      setItems(res?.items || []);
    } catch (err) {
      console.error('Failed to load workspace history:', err);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope, workbookId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = async (e, id, itemWbId) => {
    e.stopPropagation();
    if (!itemWbId) return;
    if (!window.confirm('Delete this workbook and all associated analysis records?')) return;

    setDeletingId(id);
    try {
      await deleteWorkbookApi(itemWbId);
      // Refresh history
      await fetchHistory(true);
      if (workbookId === itemWbId) {
        window.location.reload();
      }
    } catch (err) {
      alert(`Could not delete workbook: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleItemClick = async (item) => {
    if (item.workbook_id && item.workbook_id !== workbookId) {
      await switchWorkbook(item.workbook_id, item.filename);
    }
    // Route user to appropriate section
    if (item.type === 'query') {
      navigate('/ask');
    } else if (item.type === 'report') {
      navigate('/reports');
    } else if (item.type === 'cleaning') {
      navigate('/cleaning');
    } else {
      navigate('/');
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Recently';
    const now = Date.now();
    // Support both seconds and milliseconds timestamps
    const tsMs = timestamp < 1e11 ? timestamp * 1000 : timestamp;
    const diffSec = Math.floor((now - tsMs) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(tsMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredItems = filter === 'all' 
    ? items 
    : items.filter(item => item.type === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <HistoryIcon className="w-6 h-6 text-primary" /> Workspace History
          </h1>
          <p className="text-sm text-secondary mt-1">
            Chronological audit of analytical runs, Ask Your Data conversations, generated reports, and cleaning passes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Scope Selector */}
          <div className="bg-white/[0.03] border border-glass-border rounded-xl p-0.5 flex items-center">
            <button
              onClick={() => setScope('current')}
              disabled={!workbookId}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                scope === 'current'
                  ? 'bg-primary/20 text-primary border border-primary/30 font-semibold'
                  : 'text-muted hover:text-white'
              }`}
            >
              Current File
            </button>
            <button
              onClick={() => setScope('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                scope === 'all'
                  ? 'bg-primary/20 text-primary border border-primary/30 font-semibold'
                  : 'text-muted hover:text-white'
              }`}
            >
              All Workbooks
            </button>
          </div>

          <button
            onClick={() => fetchHistory(true)}
            disabled={refreshing || loading}
            className="p-2 rounded-xl text-muted hover:text-white bg-white/[0.03] border border-glass-border hover:bg-white/[0.08] transition-all"
            title="Refresh History"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['all', 'workbook', 'query', 'report', 'cleaning'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium capitalize transition-all whitespace-nowrap cursor-pointer ${
              filter === f 
                ? 'bg-primary/20 text-primary border border-primary/40 shadow-sm' 
                : 'text-muted hover:text-white hover:bg-white/5 border border-glass-border'
            }`}
          >
            {f === 'all' ? 'All Activity' : f === 'workbook' ? 'Workbooks & Runs' : f === 'query' ? 'Ask Your Data' : f === 'report' ? 'Reports' : 'Cleaning'}
          </button>
        ))}
      </div>

      {/* History Items Container */}
      <div className="glass-panel p-6 space-y-3.5">
        {loading ? (
          <div className="text-center py-16 space-y-3">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto opacity-70" />
            <p className="text-xs text-muted">Retrieving historical analytical events…</p>
          </div>
        ) : filteredItems.length > 0 ? (
          filteredItems.map(item => {
            const isCurrentWb = item.workbook_id && item.workbook_id === workbookId;
            return (
              <div 
                key={item.id} 
                onClick={() => handleItemClick(item)}
                className={`glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-primary/40 transition-all cursor-pointer ${
                  isCurrentWb ? 'border-primary/25 bg-primary/[0.02]' : ''
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-glass-border flex items-center justify-center shrink-0 text-secondary group-hover:text-primary transition-colors">
                    {item.type === 'query' && <MessageSquare className="w-4 h-4 text-ai" />}
                    {item.type === 'report' && <Sparkles className="w-4 h-4 text-emerald-400" />}
                    {item.type === 'workbook' && <FileSpreadsheet className="w-4 h-4 text-primary" />}
                    {item.type === 'cleaning' && <Clock className="w-4 h-4 text-amber-400" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-semibold text-white group-hover:text-primary transition-colors">
                        {item.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                      {isCurrentWb && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active File
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-secondary mt-1.5 max-w-3xl leading-relaxed">
                      {item.details}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted shrink-0 self-end md:self-center">
                  <div className="flex items-center gap-1 text-[11px]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatRelativeTime(item.timestamp)}</span>
                  </div>

                  {item.type === 'workbook' && item.workbook_id && (
                    <button
                      onClick={(e) => handleDelete(e, item.id, item.workbook_id)}
                      disabled={deletingId === item.id}
                      className="p-1.5 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete Workbook"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/20 flex items-center justify-center transition-colors text-muted group-hover:text-primary">
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-16 text-muted text-sm space-y-2">
            <HistoryIcon className="w-10 h-10 text-muted/50 mx-auto mb-2" />
            <div className="font-semibold text-white text-base">No workspace history found</div>
            <p className="text-xs text-secondary max-w-sm mx-auto">
              Upload a workbook, ask questions in Ask Your Data, or generate an executive report to see recorded events.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

