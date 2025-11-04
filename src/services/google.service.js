const { OAuth2Client } = require('google-auth-library');
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, PUBLIC_BASE_URL } = require('../config/env');

const googleClient = new OAuth2Client({
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  redirectUri: `${PUBLIC_BASE_URL}/auth/google/callback`,
});

function generateAuthUrl(state) {
  return googleClient.generateAuthUrl({
    access_type: 'online',
    prompt: 'consent',
    scope: ['openid', 'email', 'profile'],
    state,
  });
}

async function verifyGoogleToken(code) {
  const { tokens } = await googleClient.getToken(code);
  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

module.exports = { googleClient, generateAuthUrl, verifyGoogleToken };
