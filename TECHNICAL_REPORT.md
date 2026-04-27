# ReserveAI — Technical Report

> **Hazırlayan:** Hüseyin Ergün · Junior Fullstack Developer  
> **Tarih:** Nisan 2026 · **Versiyon:** v1.0

---

## 1. Proje Özeti ve Vizyon

### Problem

Küçük ve orta ölçekli işletmelerin %70'i randevu yönetimini hâlâ manuel süreçlerle yürütmektedir. Bu durum üç kritik verimsizliğe yol açar:

1. **Yüksek no-show oranı** — ortalama %20-30 randevu gerçekleşmez.
2. **Veri körü karar alma** — hangi müşterinin acil ihtiyacı olduğu bilinmeden tüm talepler eşit öncelikle ele alınır.
3. **Yönetici zaman kaybı** — saatlik yük e-posta okuma, manuel onaylama ve takvim güncelleme döngülerine harcanır.

### Çözüm

Yapay zeka destekli, otonom triaj ve konuşmaya dayalı analitik yeteneklerine sahip, uçtan uca randevu yönetim SaaS'ı. Sistem bir talebi aldığı andan tamamlandığı ana kadar minimum insan müdahalesiyle taşır; yöneticiye yalnızca karar noktasında bildirim üretir.

---

## 2. Teknik Yığın (Tech Stack)

| Katman | Teknoloji | Tercih Gerekçesi |
|--------|-----------|-----------------|
| Frontend | React 18 + Vite 5 + TypeScript | Vite ~10× hızlı HMR; strict TS derleme-zamanı tip kontrolü |
| Animasyon | Framer Motion 12 | `whileInView` + `viewport={{ once:false }}` ile her görünüme girişte yeniden tetiklenen Bento animasyonları |
| Stil | Tailwind CSS + cva | Tip güvenli varyant sistemi; tailwind-merge ile çakışma önleme |
| State | useReducer + Custom Hook | 16 action type'lı state machine; Set<string> ile O(1) acting tracking |
| Backend | Node.js 20 + Express 4 + TypeScript | shared/types.ts ile istemci-sunucu tip birliği |
| Logger | Winston | Structured JSON logging; production-ready log seviyeleri |
| Veritabanı | MongoDB Atlas + Mongoose | Şemasız esneklik; triage objesi sıfır migration ile eklendi |
| AI (Birincil) | Groq API — Llama 3.3-70b | ~200ms gecikme; OpenAI'ye kıyasla ~10× daha hızlı |
| AI (Alternatif) | Gemini 1.5-flash / GPT-4o-mini | Strategy Pattern ile hot-swap; tek env değişkeni yeterli |
| Auth | JWT + Bearer Token | 8 saatlik session; TokenExpiredError / geçersiz token ayrımı |
| Entegrasyon | Google Calendar, Gmail, Sheets | OAuth2 refresh token; SMTP yerine token tabanlı güvenli mail |
| Otomasyon | n8n | Webhook → onay/iptal iş akışları |
| Deploy | Railway (backend) + Render (frontend) | Backend: Railway Web Service; Frontend: Render Static Site; GitHub push → otomatik deploy |

---

## 3. Kritik Mimari Özellikler

### 3.1 JWT Tabanlı Güvenlik Mimarisi

```
POST /api/admin/login { password }
  → AdminController.login()
    → şifreyi ADMIN_SECRET_KEY ile karşılaştır
    → signAdminToken() → jwt.sign({ role:'admin' }, SECRET, { expiresIn:'8h' })
  ← { token: "eyJ..." }

Client: sessionStorage.setItem('admin_jwt', token)

Sonraki her istek: Authorization: Bearer <token>
  → requireAdminAuth middleware
    → jwt.verify() → TokenExpiredError / InvalidToken → 401
    → payload.role !== 'admin' → 403
    → başarı → next()
```

**Güvenlik Kararları:**
- Plain-text şifre hiçbir zaman localStorage'a yazılmaz; JWT sessionStorage'da tutulur (sekme kapanınca silinir).
- `JWT_SECRET` eksikse `process.exit(1)` — yapılandırma hatası production'a geçemez (fail-fast).
- Eski `x-admin-key` header pattern tamamen kaldırıldı; CORS `allowedHeaders` listesinden de silindi.

### 3.2 AI Triage ve Duygu Analizi

Bir randevu talebi geldiğinde sistem şu pipeline'ı çalıştırır:

**Adım 1 — Sınıflandırma:**
```
POST /api/form/submit → FormController
→ aiService.classifyInquiry(inquiry)
→ Groq: "BOOKING | FAQ" sınıflandırması
→ BOOKING → randevu akışı | FAQ → sohbet modu
```

**Adım 2 — Triage (fire-and-forget, HTTP yanıtını bloklamaz):**
```json
{
  "urgency":      "CRITICAL | HIGH | NORMAL | LOW",
  "sentiment":    "anxious | neutral | positive | ...",
  "clarity":      "0-100",
  "adminSummary": "Müşteri yarın 15:00 için acil randevu istiyor."
}
```

Admin panelinde görselleştirme:
- `CRITICAL` → kırmızı sol border + `animate-pulse` badge
- `HIGH` → turuncu sol border

### 3.3 Conversational BI — Admin Chatbot

```
Client → POST /api/admin/analyze { question }
  → requireAdminAuth (JWT)
  → MongoDB istatistikleri (aggregate)
  → [data + soru] → Groq sistem promptu
  ← Türkçe doğal dil yanıt
```

Örnek sorgular:
- _"En yoğun saatim hangisi?"_ → saatlik dağılım analizi
- _"Onay oranım nedir?"_ → approved/total hesabı
- _"Kaç acil randevum var?"_ → CRITICAL + HIGH count

**Rate Limiting:**
- `analyzeLimiter`: 30 istek / 15 dakika / IP — Groq maliyetini korur
- `chatLimiter`: 20 istek / dakika / IP — müşteri chatbot

### 3.4 Türkçe E-posta Şablonları

Tüm müşteri ve yönetici e-postaları Türkçeye çevrildi (`MailService`, `FormController`):

| Tetikleyici | Konu Satırı |
|-------------|-------------|
| Talep alındı | `Randevu Talebiniz Alındı — <tarih>` |
| Onaylandı | `Randevunuz Onaylandı — <ref>` |
| Reddedildi | `Randevu Talebiniz Reddedildi — <tarih>` |
| İptal edildi | `Randevunuz İptal Edildi — <ref>` |
| Yönetici bildirimi | `Yeni Randevu Talebi — <ref>` |

Form bot yanıtları da Türkçedir (FAQ yönlendirme mesajı, onay bildirimi).

---

### 3.5 E-posta ile İptal Talebi Akışı

Onay emailindeki iptal linkinin yanı sıra müşteri, randevu sorgulama ekranından da iptal başlatabilir:

```
Kullanıcı → "Randevumu Sorgula" sekmesi → e-posta gir → Sorgula
  → GET /api/form/status
  → pending/approved randevular → "🚫 İptal Talebi Gönder" butonu görünür

Butona tıklama → POST /api/form/cancel-request { email, bookingReference }
  → FormController.requestCancellation()
  → AppointmentModel: email + bookingReference + status=pending|approved ile bul
  → cancelUrl = /api/approval/cancel/:cancellationToken oluştur
  → mailService.sendCancelLinkEmail() → kullanıcıya güvenli iptal bağlantısı
  → Kullanıcı maildeki linke tıklar → GET /api/approval/cancel/:token
  → ApprovalController.cancelAppointment() → status=cancelled, takvim silme
  → /?result=cancelled yönlendirme → ResultBanner bildirim
```

**Güvenlik:** `cancellationToken` (64-char hex) API yanıtında asla dönmez; yalnızca e-posta üzerinden iletilir. İptal linki tek kullanımlıktır.

### 3.6 Zamanlanmış Görevler (Cron — Railway)

| Zamanlama | Görev |
|-----------|-------|
| Günlük 09:00 (Istanbul) | Yaklaşan randevu hatırlatma e-postası |
| Günlük 23:59 | Geçmiş onaylı randevuları `completed` statüsüne al |

Railway seçilme nedeni: Vercel serverless uzun ömürlü cron desteklemez; backend zaten Railway'de olduğundan ek maliyet oluşmaz.

---

## 4. Refactoring Süreci ve Senior Mühendislik Kararları

### 4.1 Monolitten Modüler Mimariye Geçiş

| | Başlangıç (v0.1) | Son Durum (v1.0) |
|--|----------|---------|
| `AdminDashboard.tsx` | 891 satır | ~250 satır |
| State yönetimi | 8+ `useState` | `useReducer` + 16 action |
| Auth mekanizması | `x-admin-key` plain-text | JWT Bearer Token |
| Bileşen yapısı | Monolitik | 6 ayrı component |

**Ayrıştırılan bileşenler:**
```
AdminDashboard.tsx (orchestrator)
├── useAppointments.ts   ← tüm iş mantığı
├── adminReducer.ts      ← 16 action type, tek state
├── StatCards.tsx
├── BulkActionBar.tsx
├── AppointmentTable.tsx ← tablo + mobil kart + filtre toolbar
└── AIChat.tsx
```

### 4.2 Timezone-Safe Tarih İşlemleri

**Problem:**  
`new Date(apt.dateTime).getFullYear()` yerel saat dilimini kullanır.  
Sunucu UTC'de, kullanıcı Istanbul'da (UTC+3) olduğunda yeni yıl geçişlerinde randevular yanlış günde görünür.

**Çözüm:**
```typescript
// Yanlış
new Date(apt.dateTime).getFullYear()

// Doğru
DateTime.fromISO(apt.dateTime, { zone: 'Europe/Istanbul' }).year
```

### 4.3 z-index Katman Haritası

| Seviye | Element |
|--------|---------|
| `z-20` | Tablo thead (sticky) |
| `z-40` | BulkActionBar (fixed bottom-center) |
| `z-50` | AIChat widget (fixed bottom-right) |
| `z-9999` | Footer modal panelleri |

### 4.4 Prompt Güvenliği — Halüsinasyon Önleme

Groq, bağlam olmaksızın "Randevunuz başarıyla alındı 🎉" üretmeye başladı. Çözüm:

1. Sistem promptuna **"YASAKLI ifadeler"** listesi eklendi.
2. Booking akışının deterministik adımlarında (isim/e-posta toplama) **LLM tamamen devre dışı**.
3. Sadece sınıflandırma ve triage noktalarında Groq çağrısı yapılır.

### 4.5 Google Sheets — Akıllı Satır Tespiti

**Problem:**  
`values.append` + `INSERT_ROWS` yöntemi, sililinmiş randevulardan kalan boş satırları "veri sonu" olarak yorumluyordu. Yeni satırlar mevcut verinin çok altına yazılıyordu.

**Çözüm:**  
```typescript
// Kolon A'yı okuyarak gerçek son dolu satırı bul
const colARes = await sheets.spreadsheets.values.get({ range: `${sheetName}!A:A` });
let lastFilledRow = 0;
for (let i = colAValues.length - 1; i >= 0; i--) {
  if (colAValues[i]?.[0]?.trim()) { lastFilledRow = i + 1; break; }
}
// INSERT_ROWS yerine hedef satıra doğrudan yaz
await sheets.spreadsheets.values.update({ range: `${sheetName}!A${lastFilledRow + 1}:...` });
```

Bu yaklaşım, silme işlemlerinden kalan boşlukları tamamen ortadan kaldırır.

### 4.6 API Timeout — Cold Start Toleransı

**Problem:** Railway ücretsiz katmanında soğuk başlatma (cold start) 20–30 saniye sürebilir; `axios` varsayılan 15s timeout bu pencerede ağ hatası üretiyordu.

**Çözüm:** `http` instance timeout'u **40 saniye**ye çıkarıldı. Hata mesajı da Türkçeye çevrildi:  
`"Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin."`

---

## 5. Güvenlik Katmanları (Özet)

| Katman | Mekanizma |
|--------|-----------|
| Auth | JWT 8h + TokenExpiredError ayrımı |
| Rate limit | `chatLimiter` 20/dk, `analyzeLimiter` 30/15dk |
| CORS | `allowedHeaders` listesi minimal tutuldu |
| Fail-fast | `JWT_SECRET` eksikse `process.exit(1)` |
| Session | `sessionStorage` (sekme kapanınca temizlenir) |
| LLM güvenlik | Sistem promptuna yasaklı ifade listesi |

---

## 6. Deployment ve Altyapı

| Katman | Servis | Not |
|--------|--------|-----|
| Backend API | Railway | Node.js 20, otomatik deploy |
| Frontend SPA | Render | Vite build, SPA fallback |
| Veritabanı | MongoDB Atlas | M0 → M10 geçişe hazır |
| AI | Groq Cloud | Llama 3.3-70b, ~200ms |
| Mail/Takvim | Google Cloud | OAuth2 refresh token |
| Otomasyon | n8n (Railway) | Webhook iş akışları |
| Cron | Railway | Günlük görevler |

---

## 7. Proje Metrikleri

| Metrik | Değer |
|--------|-------|
| Toplam kaynak satırı | ~5.000 (test hariç) |
| React component sayısı | 24 |
| API endpoint sayısı | 15 (7 public, 8 JWT-korumalı) |
| Ortalama API yanıt süresi | < 120ms (AI hariç) |
| AI triage süresi | ~800ms (fire-and-forget) |
| Admin analiz süresi | ~400ms |

---

*Son güncelleme: Nisan 2026 · ReserveAI v1.0*
