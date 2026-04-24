import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle, X, Send, Loader2, Bot, RotateCcw,
  CalendarDays, Clock, CheckCircle2, ChevronLeft,
} from 'lucide-react';
import { chatApi, api, type ChatMessage } from '../../services/api';
import type { DateOptionsResponse } from '@shared/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step =
  | 'faq'          // default — answers questions
  | 'name'         // collecting name
  | 'email'        // collecting email
  | 'inquiry'      // collecting inquiry text
  | 'classifying'  // calling /form/submit
  | 'date'         // picking a date
  | 'time'         // picking a time
  | 'confirming'   // show summary before submit
  | 'submitting'   // calling form APIs
  | 'success'      // done!
  | 'declined';    // inquiry rejected

interface BookingData {
  name:    string;
  email:   string;
  inquiry: string;
  date:    string;   // ISO YYYY-MM-DD
  time:    string;   // HH:MM
}

const BOOKING_KEYWORDS = [
  'randevu', 'görüşme', 'toplantı', 'rezerv', 'almak istiyorum',
  'müsait misiniz', 'book', 'schedule', 'appointment',
];

const isBookingIntent = (text: string) =>
  BOOKING_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));

const FAQ_QUICK = [
  'Fiyatlar nedir?',
  'Randevu ne kadar sürer?',
  'Nasıl iptal edebilirim?',
  'Randevu süreci nasıl işler?',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatDateTR(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso + 'T12:00:00'));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="flex items-end gap-1.5">
        <div className="w-6 h-6 rounded-full bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
          <Bot className="w-3 h-3 text-indigo-500" />
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3 py-2.5">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CustomerChat() {
  const [open, setOpen]         = useState(false);
  const [step, setStep]         = useState<Step>('faq');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [booking, setBooking]   = useState<Partial<BookingData>>({});
  const [slots, setSlots]       = useState<DateOptionsResponse | null>(null);
  const [, setBookingRef] = useState('');
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, step]);

  useEffect(() => {
    if (open && step === 'faq') inputRef.current?.focus();
  }, [open, step]);

  // Add bot message to chat
  const botSay = useCallback((content: string) => {
    setMessages((m) => [...m, { role: 'assistant', content }]);
  }, []);

  // Reset to FAQ mode
  const reset = useCallback(() => {
    setStep('faq');
    setBooking({});
    setSlots(null);
    setMessages([]);
    setInput('');
  }, []);

  // Start booking flow
  const startBooking = useCallback(() => {
    setStep('name');
    botSay('Randevu talebiniz için sizi yönlendireyim! 😊\n\nÖnce adınızı öğrenebilir miyim?');
  }, [botSay]);

  // Fetch available slots (once, when entering date step)
  const fetchSlots = useCallback(async () => {
    try {
      const data = await api.getDateOptions();
      setSlots(data);
    } catch {
      botSay('Müsait tarihleri yükleyemedim. Lütfen formu kullanarak randevu alın.');
      setStep('faq');
    }
  }, [botSay]);

  // ── Core message handler ───────────────────────────────────────────────────

  const handleSend = useCallback(async (text?: string) => {
    const raw = (text ?? input).trim();
    if (!raw || loading) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: raw };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    try {
      // ── FAQ mode ─────────────────────────────────────────────────────────
      if (step === 'faq') {
        // Only send recent messages to prevent stale booking context from confusing Groq
        const recent = [...messages, userMsg].slice(-6);
        const { response } = await chatApi.message(recent);
        botSay(response);

        // Detect booking intent in user message
        if (isBookingIntent(raw)) {
          setTimeout(() => startBooking(), 800);
        }
        return;
      }

      // ── Booking steps — sabit mesajlar, Groq çağrısı yok ────────────────
      if (step === 'name') {
        if (raw.length < 2) {
          botSay('Lütfen en az 2 karakterli geçerli bir ad girin.');
          return;
        }
        const name = raw.trim();
        setBooking((b) => ({ ...b, name }));
        setStep('email');
        botSay(`Merhaba ${name}! 👋\n\nE-posta adresinizi alabilir miyim? Onay ve hatırlatma bilgileri bu adrese gönderilecek.`);
        return;
      }

      if (step === 'email') {
        if (!isValidEmail(raw)) {
          botSay('Bu e-posta adresi geçerli görünmüyor. Lütfen "ornek@gmail.com" formatında bir adres girin.');
          return;
        }
        const email = raw.trim().toLowerCase();
        setBooking((b) => ({ ...b, email }));
        setStep('inquiry');
        botSay(`Teşekkürler! Son adım olarak:\n\nNe hakkında görüşmek istediğinizi kısaca açıklar mısınız? (Örn: "Web sitesi tasarımı hakkında danışmak istiyorum")`);
        return;
      }

      if (step === 'inquiry') {
        if (raw.length < 10) {
          botSay('Biraz daha ayrıntı verir misiniz? En az 10 karakter yazmanız yeterli.');
          return;
        }
        // Prefix short or vague inputs so the classifier sees booking intent
        const inquiry = raw.trim().length < 30
          ? `Randevu talebi: ${raw.trim()}`
          : raw.trim();
        setBooking((b) => ({ ...b, inquiry }));
        setStep('classifying');
        botSay('Talebinizi değerlendiriyorum… ⏳');

        const result = await api.submitEnquiry({
          name:    booking.name ?? '',
          email:   booking.email ?? '',
          enquiry: inquiry,
        });

        if (result.status === 'declined') {
          // Go back to inquiry so user can retry — don't drop to FAQ where Groq can hallucinate
          setStep('inquiry');
          botSay('Bu konu randevu kapsamı dışında değerlendirilebildi. Görüşmek istediğiniz konuyu biraz daha açıklar mısınız?\n\nÖrn: "Yazılım projesi için danışmanlık almak istiyorum"');
          return;
        }

        setStep('date');
        botSay('Talebiniz uygun! 🎉 Şimdi size uygun tarihi seçelim:');
        await fetchSlots();
        return;
      }
    } catch {
      botSay('Bir hata oluştu, lütfen tekrar deneyin.');
      // If we were classifying, go back to inquiry so the input reappears
      setStep((s) => s === 'classifying' ? 'inquiry' : s);
    } finally {
      setLoading(false);
    }
  }, [input, loading, step, messages, booking, botSay, startBooking, fetchSlots]);

  // ── Date / Time selection (button-based, no text input) ───────────────────

  const handleDateSelect = useCallback((iso: string) => {
    setBooking((b) => ({ ...b, date: iso }));
    setMessages((m) => [...m, { role: 'user', content: formatDateTR(iso) }]);
    setStep('time');
    botSay(`${formatDateTR(iso)} seçtiniz. Saat tercihiniz nedir?`);
  }, [botSay]);

  const handleTimeSelect = useCallback((time: string) => {
    setBooking((b) => ({ ...b, time }));
    setMessages((m) => [...m, { role: 'user', content: time }]);
    setStep('confirming');
    botSay(`${time} saatini seçtiniz. Bilgilerinizi onaylayın:`);
  }, [botSay]);

  // ── Final submit ──────────────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    const { name, email, inquiry, date, time } = booking as BookingData;
    setStep('submitting');
    setLoading(true);
    botSay('Randevu talebiniz iletiliyor… ⏳');
    try {
      await api.acceptTerms();
      const result = await api.scheduleAppointment({ name, email, enquiry: inquiry, date, time });
      const ref = result.summary?.bookingReference ?? '';
      setBookingRef(ref);
      setStep('success');
      botSay(
        `✅ Randevu talebiniz alındı!\n\nReferans: ${ref}\n\nE-posta adresinize alındı bilgisi gönderildi. İşletme sahibi talebinizi değerlendirip size dönecek (genellikle 24 saat içinde). Onaylanırsa Google Meet bağlantısı içeren bir e-posta alacaksınız.`
      );
    } catch (err: unknown) {
      const e = err as { errors?: { dateTime?: string }; error?: string };
      const msg = e?.errors?.dateTime ?? e?.error ?? 'Bir hata oluştu, lütfen tekrar deneyin.';
      setStep('confirming');
      botSay(`⚠️ ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [booking, botSay]);

  // ── Available times for selected date (filter out booked) ─────────────────

  const availableTimes = (() => {
    if (!slots || !booking.date) return [];
    const tz = 'Europe/Istanbul';
    return slots.times.filter((t) => {
      return !slots.bookedDateTimes.some((bdt) => {
        const bdtDate = new Date(bdt).toLocaleDateString('sv-SE', { timeZone: tz });
        const bdtTime = new Date(bdt).toLocaleTimeString('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
        return bdtDate === booking.date && bdtTime === t;
      });
    });
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  // 'inquiry' shown after a decline too, so user can retry with more detail
  const showInput = step === 'faq' || step === 'name' || step === 'email' || step === 'inquiry';

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3">

      {/* Chat window */}
      {open && (
        <div
          className="w-80 sm:w-96 flex flex-col rounded-2xl shadow-2xl
                     border border-slate-200/60 dark:border-slate-700/60
                     bg-white/95 dark:bg-slate-900/95 backdrop-blur-md
                     animate-slide-up overflow-hidden"
          style={{ maxHeight: 'min(560px, calc(100vh - 120px))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/50
                          bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-500/15 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-white leading-none">ReserveAI Asistan</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {step === 'faq' ? 'Sorularınıza yardımcı oluyorum' : 'Randevu oluşturuluyor…'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {step !== 'faq' && (
                <button
                  onClick={() => { reset(); }}
                  title="Yeniden başla"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {step === 'faq' && messages.length > 0 && (
                <button
                  onClick={reset}
                  title="Sohbeti temizle"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 [&::-webkit-scrollbar]:hidden min-h-0">

            {/* Welcome screen */}
            {messages.length === 0 && step === 'faq' && (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto">
                  <MessageCircle className="w-6 h-6 text-indigo-500 opacity-70" />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Merhaba! Size nasıl yardımcı olabilirim?
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                  {FAQ_QUICK.map((q) => (
                    <button key={q} onClick={() => handleSend(q)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-medium border border-indigo-300/50 dark:border-indigo-500/30
                                 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
                <button
                  onClick={startBooking}
                  className="mt-1 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                             bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Randevu Al
                </button>
              </div>
            )}

            {/* Chat messages */}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5 mr-1.5">
                    <Bot className="w-3 h-3 text-indigo-500" />
                  </div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line
                  ${m.role === 'user'
                    ? 'bg-indigo-500 text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-bl-sm'}`}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && <TypingDots />}

            {/* ── Date picker ── */}
            {step === 'date' && slots && !loading && (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> Tarih seçin
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {slots.dates.map((d) => (
                    <button key={d} onClick={() => handleDateSelect(d)}
                      className="text-left px-3 py-2 rounded-xl text-xs font-medium border border-indigo-200 dark:border-indigo-500/30
                                 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                      {formatDateTR(d)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Time picker ── */}
            {step === 'time' && !loading && (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Saat seçin
                </p>
                {availableTimes.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-red-500">Bu gün için müsait saat yok.</p>
                    <button onClick={() => { setStep('date'); setBooking((b) => ({ ...b, date: undefined, time: undefined })); }}
                      className="flex items-center gap-1 text-xs text-indigo-500 hover:underline">
                      <ChevronLeft className="w-3 h-3" /> Farklı gün seç
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {availableTimes.map((t) => (
                      <button key={t} onClick={() => handleTimeSelect(t)}
                        className="px-2 py-2 rounded-xl text-xs font-semibold border border-indigo-200 dark:border-indigo-500/30
                                   text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors text-center">
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Booking summary ── */}
            {step === 'confirming' && !loading && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 p-3 space-y-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Özet</p>
                {([
                  ['Ad',      booking.name],
                  ['E-posta', booking.email],
                  ['Konu',    booking.inquiry],
                  ['Tarih',   booking.date ? formatDateTR(booking.date) : ''],
                  ['Saat',    booking.time],
                ] as [string, string | undefined][]).map(([label, value]) => value && (
                  <div key={label} className="flex gap-2 text-xs">
                    <span className="w-14 text-slate-400 flex-shrink-0">{label}</span>
                    <span className="text-slate-700 dark:text-slate-300 line-clamp-2">{value}</span>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button onClick={handleConfirm}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Onayla & Gönder
                  </button>
                  <button onClick={() => { setStep('date'); setBooking((b) => ({ ...b, date: undefined, time: undefined })); }}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    Değiştir
                  </button>
                </div>
              </div>
            )}

            {/* ── Success ── */}
            {step === 'success' && (
              <div className="space-y-2">
                <button onClick={reset}
                  className="w-full py-2 rounded-xl border border-indigo-200 dark:border-indigo-500/30 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                  Yeni Soru Sor
                </button>
              </div>
            )}

            {/* ── Declined ── */}
            {step === 'declined' && (
              <button onClick={() => setStep('faq')}
                className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Soru Sormaya Devam Et
              </button>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input — only shown in text-entry steps */}
          {showInput && (
            <div className="px-3 py-2.5 border-t border-slate-200 dark:border-slate-700/50 flex items-center gap-2 flex-shrink-0 bg-white/50 dark:bg-slate-900/50">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={
                  step === 'name'    ? 'Adınızı yazın…' :
                  step === 'email'   ? 'E-posta adresiniz…' :
                  step === 'inquiry' ? 'Randevu konusunu açıklayın…' :
                  'Mesajınızı yazın…'
                }
                className="flex-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2 outline-none
                           text-slate-700 dark:text-slate-300 placeholder-slate-400 border border-transparent
                           focus:border-indigo-300 dark:focus:border-indigo-500/50 transition-colors"
              />
              <button onClick={() => handleSend()} disabled={loading || !input.trim()}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-500 text-white
                           hover:bg-indigo-600 disabled:opacity-40 transition-all hover:scale-105 active:scale-95 flex-shrink-0">
                {loading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-16 h-16 rounded-full shadow-xl text-white flex items-center justify-center
                    transition-all duration-200 hover:scale-110 active:scale-95
                    ${open
                      ? 'bg-slate-600 hover:bg-slate-700'
                      : 'bg-indigo-500 hover:bg-indigo-600 ring-4 ring-indigo-500/20'}`}
        title={open ? 'Kapat' : 'Asistan'}
      >
        {open
          ? <X className="w-6 h-6" />
          : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
