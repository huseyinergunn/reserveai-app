import { Loader2, Trash2, Award, XCircle } from 'lucide-react';

interface BulkActionBarProps {
  count:        number;
  loading:      boolean;
  archiveMode:  'active' | 'archive' | 'all';
  onCancel:     () => void;
  onComplete:   () => void;
  onDelete:     () => void;
  onClear:      () => void;
}

export function BulkActionBar({ count, loading, archiveMode, onCancel, onComplete, onDelete, onClear }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
      <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl
                      bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {count} randevu seçildi
        </span>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

        {archiveMode !== 'archive' && (
          <>
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                         text-red-700 dark:text-red-400 bg-red-500/10 border border-red-300 dark:border-red-500/30
                         hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Toplu İptal
            </button>
            <button
              onClick={onComplete}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                         text-blue-700 dark:text-blue-400 bg-blue-500/10 border border-blue-300 dark:border-blue-500/30
                         hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
              Tamamlandı
            </button>
          </>
        )}
        {archiveMode !== 'active' && (
          <button
            onClick={onDelete}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                       text-red-700 dark:text-red-400 bg-red-500/10 border border-red-300 dark:border-red-500/30
                       hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Kalıcı Sil
          </button>
        )}

        <button
          onClick={onClear}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          title="Seçimi temizle"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
