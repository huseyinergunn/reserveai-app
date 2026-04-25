import Groq from 'groq-sdk';
import { DateTime } from 'luxon';
import type { AiService } from './AiService';
import type { ClassificationResult, ExtractedAppointmentData, TriageResult } from '../../../../shared/types';
import { logger } from '../../utils/logger';

export class GroqService implements AiService {
  private readonly client: Groq;
  private static readonly MAX_CHARS = 500;

  constructor(
    apiKey: string,
    private readonly model = 'llama-3.3-70b-versatile',
  ) {
    if (!apiKey) throw new Error('Groq API key is required.');
    this.client = new Groq({ apiKey });
  }

  async classifyEnquiry(enquiry: string): Promise<ClassificationResult> {
    const safe = enquiry.slice(0, GroqService.MAX_CHARS);

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an appointment booking classifier. Your job is to decide whether the user's message is a request to book, schedule, or inquire about an appointment or meeting.

Classify as "relevant" if the message contains ANY of the following (in any language, including Turkish):
- A request to meet, talk, schedule, book, or arrange an appointment
- Words like: randevu, görüşme, toplantı, meet, schedule, book, appointment, call, consultation
- Time or date references in the context of scheduling (e.g. "Monday", "next week", "saat 10", "Pazartesi")
- A service inquiry that implies wanting to discuss or meet
- Any question about availability or booking

Classify as "other" ONLY if the message is clearly NOT about scheduling — for example: spam, generic greetings with no intent, or completely unrelated topics.

When in doubt, choose "relevant". It is better to accept a borderline request than to reject a genuine one.

Reply ONLY with valid JSON: {"category":"relevant"} or {"category":"other"}.`,
          },
          { role: 'user', content: safe },
        ],
      });

      const raw = res.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as { category?: string };
      const category = parsed.category === 'relevant' ? 'relevant' : 'other';

      logger.debug(`[GroqService] Classification: ${category}`);
      return { category };
    } catch (err) {
      logger.error('[GroqService] classifyEnquiry failed:', err);
      throw new Error(`Groq classification failed: ${(err as Error).message}`);
    }
  }

  async summariseEnquiry(enquiry: string): Promise<string> {
    const safe = enquiry.slice(0, GroqService.MAX_CHARS);

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: 'Sen sadece Türkçe konuşan bir asistansın. Görevin randevu taleplerini özetlemektir. Asla İngilizce açıklama yapma, İngilizce kelime kullanma ve çeviri yapmaya çalışma. Sadece talebin ne olduğunu Türkçe olarak yaz. Örn: "Çarşamba saat 13:00 için randevu talebi."',
          },
          {
            role: 'user',
            content: `Aşağıdaki randevu talebini Türkçe özetle (tek cümle, yalnızca Türkçe):\n\n${safe}`,
          },
        ],
      });

      return res.choices[0]?.message?.content?.trim() ?? enquiry;
    } catch (err) {
      logger.error('[GroqService] summariseEnquiry failed:', err);
      throw new Error(`Groq summarisation failed: ${(err as Error).message}`);
    }
  }

  async triageEnquiry(enquiry: string): Promise<TriageResult> {
    const safe = enquiry.slice(0, GroqService.MAX_CHARS);

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Sen bir randevu sistemi triaj motorusun. Verilen randevu talebini analiz et ve yalnızca geçerli JSON döndür.

Karar kriterleri:
- urgency CRITICAL: "acil", "bugün", "yarın sabah", "çok acele", sağlık/hukuki/finansal acil durum belirtisi
- urgency HIGH: Yakın tarih (2-3 gün içinde), açık endişe veya baskı ifadesi
- urgency NORMAL: Standart randevu, belirli bir tarih/saat verilmiş
- urgency LOW: "bir ara", "ne zaman olsa", belirsiz niyet, kesin tarih yok

- sentiment POSITIVE: Olumlu dil, teşekkür, sabırlı beklenti
- sentiment NEUTRAL: Tarafsız, iş odaklı
- sentiment ANXIOUS: Endişe, belirsizlik, çok soru işareti
- sentiment FRUSTRATED: Hayal kırıklığı, şikayet, geçmiş kötü deneyim

- clarity: 0-100. 100 = tam olarak ne istediği belli. 0 = hiç belli değil.
- adminSummary: Admin için tek cümle TÜRKÇE özet. "Müşteri [ne istiyor], [varsa önemli detay]" formatında. ASLA İngilizce kullanma. Örnek: "Müşteri Cuma saat 15:00 için danışmanlık randevusu istiyor."

Output (sadece JSON, başka hiçbir şey — adminSummary alanı kesinlikle Türkçe olmalı):
{"urgency":"LOW|NORMAL|HIGH|CRITICAL","sentiment":"POSITIVE|NEUTRAL|ANXIOUS|FRUSTRATED","clarity":0-100,"adminSummary":"string"}`,
          },
          { role: 'user', content: safe },
        ],
      });

      const raw = res.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as Partial<TriageResult>;

      const urgencyValues   = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
      const sentimentValues = ['POSITIVE', 'NEUTRAL', 'ANXIOUS', 'FRUSTRATED'] as const;

      const urgency      = urgencyValues.includes(parsed.urgency as typeof urgencyValues[number])
        ? (parsed.urgency as TriageResult['urgency'])
        : 'NORMAL';
      const sentiment    = sentimentValues.includes(parsed.sentiment as typeof sentimentValues[number])
        ? (parsed.sentiment as TriageResult['sentiment'])
        : 'NEUTRAL';
      const clarity      = typeof parsed.clarity === 'number' ? Math.min(100, Math.max(0, parsed.clarity)) : 50;
      const adminSummary = typeof parsed.adminSummary === 'string' ? parsed.adminSummary.trim() : '';

      logger.debug(`[GroqService] Triage: urgency=${urgency} sentiment=${sentiment} clarity=${clarity}`);
      return { urgency, sentiment, clarity, adminSummary, processedAt: new Date().toISOString() };
    } catch (err) {
      logger.warn('[GroqService] triageEnquiry failed (non-fatal):', err);
      return { urgency: 'NORMAL', sentiment: 'NEUTRAL', clarity: 50, adminSummary: '', processedAt: new Date().toISOString() };
    }
  }

  private static readonly CUSTOMER_SYSTEM = `Sen ReserveAI randevu sisteminin Türkçe konuşan müşteri destek asistanısın. Kısa (2-3 cümle), dostane ve profesyonel cevaplar verirsin. Asla İngilizce kullanma.

HİZMET BİLGİLERİ:
- Her randevu 1 saat sürer
- Hafta içi (Pazartesi–Cuma), 09:00–18:00 saatleri arasında randevu alınabilir

FİYATLANDIRMA:
- Başlangıç: Ücretsiz — Aylık 10 randevu, temel AI, e-posta onayı
- Pro: ₺299/ay — Sınırsız randevu, gelişmiş AI (Groq + GPT), Google Takvim senkronizasyonu, n8n entegrasyonu, öncelikli destek
- Kurumsal: Özel fiyat — Tüm Pro özellikleri + 7/24 özel destek ve özel entegrasyonlar

RANDEVU SÜRECİ:
1. Müşteri talep oluşturur (ad, e-posta, konu, tarih/saat seçimi)
2. İşletme sahibi değerlendirir — genellikle 24 saat içinde yanıt verilir
3. Onaylanırsa: Onay e-postası + Google Meet bağlantısı gönderilir
4. Randevudan önce otomatik hatırlatma e-postası gönderilir

İPTAL:
- Yöntem 1: Onay e-postasındaki "Randevuyu İptal Et" linkine tıklanır
- Yöntem 2: Bu sayfadaki "Randevumu Sorgula" sekmesine gidilir, e-posta adresi girilir ve randevunun yanındaki "İptal Talebi Gönder" butonuna tıklanır — e-posta adresinize iptal bağlantısı gönderilir, o bağlantıya tıklayınca iptal tamamlanır
- Takvim etkinliği otomatik silinir ve işletmeye bildirim gider

ÖNEMLİ:
- Admin onayı olmadan randevu teyit edilmez — sadece talep oluşturulur
- Dolu saatlere yeni randevu verilemez, sistem bunu otomatik engeller
- Geçerli e-posta zorunludur

KESİNLİKLE YASAKLI — BU İFADELERİ ASLA KULLANMA:
- "Randevunuz alındı", "talebiniz kaydedildi", "randevunuz oluşturuldu" veya benzeri ifadeler
- Randevu oluşturduğunu, kaydettiğini veya teyit ettiğini ima eden her türlü cümle
- Sen teknik olarak randevu oluşturamazsın — bu işlem yalnızca sohbet arayüzündeki adım adım form üzerinden yapılır
Kullanıcı randevu almak istediğinde şunu söyle: "Randevu almak için lütfen 'Randevu Al' butonuna tıklayın veya adınızı yazarak başlayın."`;


  async customerChat(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: GroqService.CUSTOMER_SYSTEM },
          ...messages,
        ],
      });
      return res.choices[0]?.message?.content?.trim() ?? 'Üzgünüm, şu an cevap veremiyorum. Lütfen tekrar deneyin.';
    } catch (err) {
      logger.error('[GroqService] customerChat failed:', err);
      throw new Error(`Groq customer chat failed: ${(err as Error).message}`);
    }
  }

  async analyzeAppointments(context: string, question: string): Promise<string> {
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'Sen bir İşletme Analistisin. Sana hem özet istatistikler hem de son 100 randevunun detay listesi (sonRandevular alanı) gönderiliyor. Kullanıcının sorusuna bu verilere dayanarak kısa, profesyonel ve sadece Türkçe cevap ver. Eğer kullanıcı spesifik bir isim, e-posta veya referans kodu sorarsa önce sonRandevular listesini kontrol ederek cevap ver. Veride olmayan şeyi uydurma. Cevabın 2-4 cümleyi geçmesin.',
          },
          {
            role: 'user',
            content: `Randevu verileri:\n${context}\n\nSoru: ${question}`,
          },
        ],
      });

      return res.choices[0]?.message?.content?.trim() ?? 'Cevap alınamadı.';
    } catch (err) {
      logger.error('[GroqService] analyzeAppointments failed:', err);
      throw new Error(`Groq analiz hatası: ${(err as Error).message}`);
    }
  }

  async extractDateTime(
    enquiry: string,
    availableDates: string[],
    availableTimes: readonly string[],
  ): Promise<ExtractedAppointmentData> {
    const safe = enquiry.slice(0, GroqService.MAX_CHARS);
    const today = DateTime.now().setZone('Europe/Istanbul').toFormat('yyyy-MM-dd');

    // Build human-readable date labels for the AI
    const dateList = availableDates.map((iso) => {
      const label = new Intl.DateTimeFormat('tr-TR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'Europe/Istanbul',
      }).format(new Date(iso + 'T12:00:00'));
      return `${iso} (${label})`;
    }).join('\n');

    const timeList = availableTimes.join(', ');

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Today is ${today}. The user is booking an appointment and may have mentioned a preferred date or time in their message.

Available dates (ISO — Turkish label):
${dateList}

Available time slots (24-hour, UTC+3): ${timeList}

Your job: extract the user's intended date and time and return them exactly as listed above.

TIME NORMALISATION RULES (strict):
- Any bare number 8–18 is a 24-hour hour → pad to HH:00. Examples:
    "14 için"  → "14:00"
    "saat 14"  → "14:00"
    "14'te"    → "14:00"
    "saat 9"   → "09:00"
    "9'da"     → "09:00"
    "öğle"/"öğlen"          → "12:00"
    "öğleden sonra 2"/"4 pm" → "14:00"
    "akşam 5"               → "17:00"
    "sabah 10"              → "10:00"
- After normalising, pick the EXACT matching slot from the list above (or closest if not exact).
- If no time mentioned at all → null.

DATE RULES:
- date: one of the ISO dates above, or null
- Turkish day names: Pazartesi=Mon, Salı=Tue, Çarşamba=Wed, Perşembe=Thu, Cuma=Fri
- confidence: "high"=clearly stated, "low"=inferred, "none"=not mentioned
- suggestionMessage: brief Turkish note if low, null otherwise

OUTPUT: valid JSON only — no markdown.
{"date":"YYYY-MM-DD or null","time":"HH:MM or null","confidence":"high|low|none","suggestionMessage":"string or null"}`,
          },
          { role: 'user', content: safe },
        ],
      });

      const raw = res.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as Partial<ExtractedAppointmentData>;

      // Validate returned values are actually in the allowed lists
      const date = parsed.date && availableDates.includes(parsed.date) ? parsed.date : null;
      const time = parsed.time && (availableTimes as readonly string[]).includes(parsed.time) ? parsed.time : null;
      const confidence = (['high', 'low', 'none'] as const).includes(parsed.confidence as 'high' | 'low' | 'none')
        ? (parsed.confidence as ExtractedAppointmentData['confidence'])
        : 'none';
      const suggestionMessage = typeof parsed.suggestionMessage === 'string' ? parsed.suggestionMessage : null;

      logger.debug(`[GroqService] Extracted: date=${date}, time=${time}, confidence=${confidence}`);
      return { date, time, confidence, suggestionMessage };
    } catch (err) {
      logger.warn('[GroqService] extractDateTime failed (non-fatal):', err);
      return { date: null, time: null, confidence: 'none', suggestionMessage: null };
    }
  }
}
