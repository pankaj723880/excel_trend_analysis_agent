import { History as HistoryIcon, Clock, ArrowRight, MessageSquare, Database, Sparkles, Trash2 } from 'lucide-react';
import { useWorkbook } from '../context/WorkbookContext';

export default function History() {
  const { workbookId, filename, selectedSheet } = useWorkbook();
  const [filter, setFilter] = useState('all');

  const historyItems = [
    {
      id: 1,
      type: 'workbook',
      title: workbookId ? `Audited sheet: ${selectedSheet}` : 'Uploaded financial_metrics.xlsx',
      time: '12 minutes ago',
      details: 'Calculated descriptive statistics, IQR outliers, and Pearson correlation coefficients.',
      badge: 'Analysis Run',
      badgeColor: 'text-primary bg-primary/10 border-primary/20'
    },
    {
      id: 2,
      type: 'query',
      title: 'Question: "What is the primary trend driver across top revenue rows?"',
      time: '24 minutes ago',
      details: 'Verified calculations via Pandas engine; synthesized natural language breakdown with Gemini.',
      badge: 'Ask Your Data',
      badgeColor: 'text-ai bg-ai/10 border-ai/20'
    },
    {
      id: 3,
      type: 'report',
      title: 'Executive Intelligence & Performance Audit (v1.0)',
      time: '1 hour ago',
      details: 'Synthesized management brief covering momentum, completeness, and recommended actions.',
      badge: 'Report Generated',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    },
    {
      id: 4,
      type: 'cleaning',
      title: 'Data Cleaning Studio Audit',
      time: '2 hours ago',
      details: 'Inspected missing values across schema, flagged 12 outliers via IQR boxplot evaluation.',
      badge: 'Cleaning Pass',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    }
  ];

  const filteredItems = filter === 'all' 
    ? historyItems 
    : historyItems.filter(item => item.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <HistoryIcon className="w-6 h-6 text-primary" /> Workspace History
          </h1>
          <p className="text-sm text-secondary mt-1">
            Timeline of analytical executions, conversational inquiries, and audit events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {['all', 'workbook', 'query', 'report', 'cleaning'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                filter === f 
                  ? 'bg-primary/20 text-primary border border-primary/40' 
                  : 'text-muted hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6 space-y-4">
        {filteredItems.map(item => (
          <div 
            key={item.id} 
            className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-primary/40 transition-all"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-glass-border flex items-center justify-center shrink-0 text-secondary group-hover:text-primary transition-colors">
                {item.type === 'query' && <MessageSquare className="w-4 h-4 text-ai" />}
                {item.type === 'report' && <Sparkles className="w-4 h-4 text-emerald-400" />}
                {item.type === 'workbook' && <Database className="w-4 h-4 text-primary" />}
                {item.type === 'cleaning' && <Clock className="w-4 h-4 text-amber-400" />}
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-semibold text-white">{item.title}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                </div>
                <p className="text-xs text-secondary mt-1 max-w-2xl">{item.details}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted shrink-0 self-end md:self-center">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{item.time}</span>
              </div>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-muted text-sm">
            No history recorded for this category yet.
          </div>
        )}
      </div>
    </div>
  );
}
