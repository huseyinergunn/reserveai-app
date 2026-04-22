import { google } from 'googleapis';
import readline from 'readline';

const CLIENT_ID = '146653431453-sbakbejlelcut90aihggol3hqgqnes4o.apps.googleusercontent.com';
const CLIENT_SECRET = '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'; 
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/calendar'
  ],
  prompt: 'consent'
});

console.log('\n1. Şu linke tıkla ve izin ver:\n', authUrl);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('\n2. Tarayıcıdaki linkten dönen "code" değerini buraya yapıştır: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n✅ İŞTE YENİ REFRESH TOKENIN:\n');
    console.log(tokens.refresh_token);
  } catch (err) {
    console.error('Hata oluştu:', err.message);
  }
  rl.close();
});