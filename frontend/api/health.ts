import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-gateway-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    data_mode: 'LIVE_AUTHORISED_DATA',
    provider: 'Angel One SmartAPI & Coinbase Live Data',
    banner: 'CONNECTED — Live Market Data Active'
  });
}
