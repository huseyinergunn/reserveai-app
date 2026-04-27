import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Loader2, MessageSquareDashed, Sparkles, RotateCcw, RefreshCw, Trash2 } from 'lucide-react';
import { adminApi } from '../../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_QUESTIONS = [
  'En yoğun saatim hangisi?',
  'Onay oranım nedir?',
  'Kaç acil randevum var?',
  'Son 7 günde kaç talep geldi?',
];

// After this many ms with no response, show the recovery UI
const RECOVERY_MS = 15_000;

// ---------------------------------------------------------------------------
// AIChat
// ---------------------------------------------------------------------------

// adminKey prop is kept for API compatibility but no longer used for auth
// (JWT token is read directly from sessionStorage by adminHttp())
export function AIChat({ adminKey: _adminKey }: { adminKey: string }) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [isStuck, setIsStuck]   = useState(false);

  const bottomRef       = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Focus input on open ────────────────────────────────────────────────────

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // ── Cleanup recovery timer on unmount ──────────────────────────────────────

  useEffect(() => {
    return () => { if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current); };
  }, []);

  // ── Send ───────────────────────────────────────────────────────────────────

  const send = useCallback(async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;

    // Pre-flight: check connectivity before bothering the server
    if (!navigator.onLine) {
      setMessages((m) => [
        ...m,
        { role: 'user', content: q },
        { role: 'assistant', content: 'İnternet bağlantısı algılanamadı. Lütfen bağlantınızı kontrol edip tekrar deneyin.' },
      ]);
      return;
    }

    setInput('');
    setIsStuck(false);
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setLoading(true);

    // Start recovery timer — if no response arrives in time, surface the retry UI
    recoveryTimerRef.current = setTimeout(() => setIsStuck(true), RECOVERY_MS);

    try {
      const { answer } = await adminApi.analyze(q);
      setMessages((m) => [...m, { role: 'assistant', content: answer }]);
    } catch (err: unknown) {
      const e   = err as { error?: string; message?: string };
      const raw = e?.error ?? e?.message ?? '';
      // Distinguish timeout / connectivity from generic AI errors
      const msg = raw.includes('yoğun') || raw.includes('zaman') || raw.includes('timeout')
        ? 'Şu an yoğunluk var, lütfen birkaç saniye bekleyip tekrar deneyin.'
        : raw || 'Bir hata oluştu. Lütfen tekrar deneyin.';
      setMessages((m) => [...m, { role: 'assistant', content: msg }]);
    } finally {
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
      setIsStuck(false);
      setLoading(false);
    }
  }, [input, loading]);

  // ── Recovery actions ───────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    // Pull the last user message and resend
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    setIsStuck(false);
    setLoading(false);
    if (lastUser) {
      // Small delay so state settles before re-entry
      setTimeout(() => send(lastUser.content), 50);
    }
  }, [messages, send]);

  const handleReset = useCallback(() => {
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    setMessages([]);
    setLoading(false);
    setIsStuck(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Chat window */}
      {open && (
        <div
          className="w-80 sm:w-96 flex flex-col rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60
                     bg-white/95 dark:bg-slate-900/95 backdrop-blur-md animate-slide-up overflow-hidden"
          style={{ maxHeight: 'min(520px, calc(100vh - 120px))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/50
                          bg-gradient-to-r from-brand-500/10 via-purple-500/5 to-transparent flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-brand-500/15 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-white leading-none">Analitik Asistan</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Randevularınız hakkında soru sorun</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={handleReset}
                  title="Yeni sohbet"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 [&::-webkit-scrollbar]:hidden min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto">
                  <MessageSquareDashed className="w-6 h-6 text-brand-500 opacity-70" />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Randevu istatistiklerinizi analiz ediyorum.<br />Bir soru sorun!
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      disabled={loading}
                      className="px-2.5 py-1 rounded-full text-[10px] font-medium border border-brand-300/50 dark:border-brand-500/30
                                 text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 transition-colors disabled:opacity-40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-full bg-brand-500/15 flex items-center justify-center flex-shrink-0 mt-0.5 mr-1.5">
                    <Bot className="w-3 h-3 text-brand-500" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed
                    ${m.role === 'user'
                      ? 'bg-brand-500 text-white rounded-br-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-bl-sm'}`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Typing indicator + recovery UI */}
            {loading && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-start items-end gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-brand-500/15 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-brand-500" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>

                {/* Recovery UI — appears after RECOVERY_MS with no response */}
                {isStuck && (
                  <div className="ml-6 flex flex-col gap-1.5 animate-fade-in">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      Bu kadar sürmemeli. Ne yapmak istersiniz?
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleRetry}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium
                                   bg-brand-500/10 text-brand-600 dark:text-brand-400
                                   hover:bg-brand-500/20 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Tekrar Dene
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium
                                   bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400
                                   hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Sıfırla
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-slate-200 dark:border-slate-700/50 flex items-center gap-2 flex-shrink-0 bg-white/50 dark:bg-slate-900/50">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Soru sorun…"
              disabled={loading}
              className="flex-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2 outline-none
                         text-slate-700 dark:text-slate-300 placeholder-slate-400 border border-transparent
                         focus:border-brand-300 dark:focus:border-brand-500/50 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-brand-500 text-white
                         hover:bg-brand-600 disabled:opacity-40 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
            >
              {loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-16 h-16 rounded-full shadow-xl text-white flex items-center justify-center
                    transition-all duration-200 hover:scale-110 active:scale-95
                    ${open
                      ? 'bg-slate-600 hover:bg-slate-700'
                      : 'bg-brand-500 hover:bg-brand-600 ring-4 ring-brand-500/20'}`}
        title={open ? 'Kapat' : 'AI Analitik Asistan'}
      >
        {open
          ? <X className="w-6 h-6" />
          : <Bot className="w-6 h-6" />}
      </button>
    </div>
  );
}
