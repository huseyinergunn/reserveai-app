/**
 * Google OAuth2 Refresh Token Generator
 *
 * Bu script, Gmail + Google Calendar + Google Sheets için tek bir
 * refresh token üretir. Mevcut GOOGLE_CALENDAR_REFRESH_TOKEN değerini
 * bu script'ten çıkan değerle değiştirmen gerekiyor.
 *
 * Nasıl çalıştırılır:
 *   node scripts/generate-google-token.js
 *
 * Ön koşullar:
 *   - Google Cloud Console > OAuth consent screen > Scopes kısmında
 *     aşağıdaki üç scope eklenmiş olmalı
 *   - Authorized redirect URIs listesinde http://localhost:3001/callback olmalı
 */

'use strict';

const http    = require('http');
const url     = require('url');
const { google } = require('googleapis');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// ── Config ────────────────────────────────────────────────────────────────────

// Önce GMAIL_CLIENT_ID dene, yoksa GOOGLE_CALENDAR_CLIENT_ID'ye düş
const CLIENT_ID     = process.env.GMAIL_CLIENT_ID     || process.env.GOOGLE_CALENDAR_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:3001/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌  GMAIL_CLIENT_ID/SECRET veya GOOGLE_CALENDAR_CLIENT_ID/SECRET .env içinde eksik.\n');
  process.exit(1);
}

console.log(`\nℹ️  OAuth client: ${CLIENT_ID.slice(0, 20)}...`);

// ── Scopes ────────────────────────────────────────────────────────────────────
// Tüm servislerin ihtiyacı olan scope'lar tek bir token altında toplanıyor.

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',        // MailService
  'https://www.googleapis.com/auth/calendar',           // CalendarService (okuma + yazma)
  'https://www.googleapis.com/auth/spreadsheets',       // SheetsService (okuma + yazma)
];

// ── OAuth2 flow ───────────────────────────────────────────────────────────────

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope:       SCOPES,
  prompt:      'consent', // Her seferinde refresh_token dönsün diye zorunlu
});

console.log('\n─────────────────────────────────────────────────────────────────');
console.log('  Adım 1 — Tarayıcında şu URL\'i aç ve Google hesabınla giriş yap:');
console.log('─────────────────────────────────────────────────────────────────\n');
console.log(authUrl);
console.log('\n─────────────────────────────────────────────────────────────────');
console.log('  Adım 2 — İzin verdikten sonra bu terminal\'e dön.');
console.log('  Token otomatik yazdırılacak.');
console.log('─────────────────────────────────────────────────────────────────\n');

// ── Local callback server ─────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (!parsed.pathname.startsWith('/callback')) return;

  const code = parsed.query.code;
  if (!code) {
    res.writeHead(400);
    res.end('Kod bulunamadı. Tekrar dene.');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(String(code));

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <h2 style="font-family:sans-serif;color:green">✅ Token alındı!</h2>
      <p style="font-family:sans-serif">Terminali kontrol et. Bu pencereyi kapatabilirsin.</p>
    `);

    console.log('\n✅  YENİ REFRESH TOKEN:');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(tokens.refresh_token ?? '(boş geldi — "prompt: consent" ile tekrar dene)');
    console.log('─────────────────────────────────────────────────────────────────\n');
    console.log('📋  Render Dashboard\'a giderek şu değişkenleri güncelle:');
    console.log('    GMAIL_REFRESH_TOKEN              =  (yukarıdaki değer)');
    console.log('    GOOGLE_CALENDAR_REFRESH_TOKEN    =  (yukarıdaki değer)');
    console.log('\n    Not: İkisi için aynı token kullanılır.\n');

  } catch (err) {
    res.writeHead(500);
    res.end('Token alınamadı: ' + err.message);
    console.error('\n❌  Hata:', err.message, '\n');
  } finally {
    server.close();
  }
});

server.listen(3001, () => {
  console.log('⏳  Callback sunucusu başladı (port 3001). Tarayıcıda URL\'i açmayı bekliyorum...\n');
});
