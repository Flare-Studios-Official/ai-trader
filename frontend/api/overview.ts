import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function getTOTP(secret: string): string {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (let i = 0; i < secret.length; i++) {
    const val = base32chars.indexOf(secret.charAt(i).toUpperCase());
    if (val >= 0) bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  const epoch = Math.floor(Date.now() / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(epoch / 0x100000000), 0);
  msg.writeUInt32BE(epoch >>> 0, 4);
  const hmac = crypto.createHmac('sha1', Buffer.from(bytes));
  hmac.update(msg);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0xf;
  const code = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

async function getAngelJwtToken(): Promise<string | null> {
  const apiKey = process.env.ANGEL_API_KEY;
  const clientCode = process.env.ANGEL_CLIENT_CODE;
  const pin = process.env.ANGEL_PIN;
  const totpSecret = process.env.ANGEL_TOTP_SECRET;

  if (!apiKey || !clientCode || !pin || !totpSecret) {
    return null;
  }

  try {
    const totp = getTOTP(totpSecret);
    const res = await fetch('https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': process.env.ANGEL_CLIENT_PUBLIC_IP || '49.43.222.66',
        'X-MACAddress': 'fe80::1',
        'X-PrivateKey': apiKey,
      },
      body: JSON.stringify({ clientcode: clientCode, password: pin, totp }),
    });
    const data = await res.json();
    if (data?.status && data?.data?.jwtToken) {
      return String(data.data.jwtToken);
    }
  } catch {
  }
  return null;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const jwt = await getAngelJwtToken();
  const apiKey = process.env.ANGEL_API_KEY;

  if (!jwt || !apiKey) {
    return res.status(503).json({
      error: 'Direct serverless market endpoint requires Angel One env configuration. Use Cloudflare Gateway -> Supabase trader-api.',
      data_mode: 'UNAVAILABLE',
    });
  }

  try {
    const quoteRes = await fetch('https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': process.env.ANGEL_CLIENT_PUBLIC_IP || '49.43.222.66',
        'X-MACAddress': 'fe80::1',
        'X-PrivateKey': apiKey,
      },
      body: JSON.stringify({
        mode: 'FULL',
        exchangeTokens: {
          NSE: ['99926000', '99926009', '99926037', '99926074'],
          BSE: ['99919000', '99919012'],
        },
      }),
    });
    const json = await quoteRes.json();
    return res.status(200).json({ ok: true, fetched: json?.data?.fetched || [] });
  } catch (e) {
    return res.status(502).json({ error: String(e), data_mode: 'UNAVAILABLE' });
  }
}
