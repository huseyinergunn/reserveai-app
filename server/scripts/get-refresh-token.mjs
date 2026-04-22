/**
 * get-refresh-token.mjs
 * ─────────────────────
 * Gmail + Google Calendar için tek seferlik Refresh Token üretir.
 *
 * Çalıştır: node server/scripts/get-refresh-token.mjs
 *
 * Node.js v17+ localhost → ::1 (IPv6) çözümler; Google ise IPv4 bekler.
 * Bu yüzden her yerde 127.0.0.1 kullanıyoruz.
 */

import { createServer } from 'http';
import { google } from 'googleapis';

// ── Buraya yeni credentials'ı gir ──────────────────────────────────────────
const CLIENT_ID = '146653431453-sbakbejlelcut90aihggol3hqqqnes4o.apps.googleusercontent.com';
const CLIENT_SECRET = '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'; // Yeni Secret'ın
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets',
];
// ───────────────────────────────────────────────────────────────────────────

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt:      'consent',
  scope:       SCOPES,
});

console.log('\n──────────────────────────────────────────────────');
console.log('1) Şu URL\'i tarayıcıda aç ve reserveaiapp@gmail.com ile giriş yap:');
console.log('\n' + authUrl + '\n');
console.log('2) İzin verdikten sonra 127.0.0.1:4000 adresine otomatik yönlendirileceksin.');
console.log('3) Refresh token bu terminalde görünecek — .env dosyasına yapıştır.');
console.log('──────────────────────────────────────────────────\n');

const server = createServer(async (req, res) => {
  const url  = new URL(req.url, 'http://127.0.0.1:4000');
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('Missing code parameter');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Başarılı! Terminale bakın.</h2>');

    console.log('\n✅ TOKEN ALINDI\n');
    console.log('GMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('GOOGLE_CALENDAR_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('\n.env dosyasındaki BURAYA_YENI_REFRESH_TOKEN_GELECEK ifadelerini bu değerle değiştir.\n');
  } catch (err) {
    res.writeHead(500);
    res.end('Token alınamadı: ' + err.message);
    console.error('Token hatası:', err);
  } finally {
    server.close();
  }
});

// '127.0.0.1' ile bağla — IPv6 ::1 yerine kesinlikle IPv4
server.listen(4000, '127.0.0.1', () => {
  console.log('Callback server hazır: http://127.0.0.1:4000');
});
