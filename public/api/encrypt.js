// api/encrypt.js
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message, passcode } = req.body || {};
  if (!message || !passcode) return res.status(400).json({ error: 'Message and passcode required' });

  try {
    const algorithm = 'aes-256-ctr';
    const key = crypto.createHash('sha256').update(passcode).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]).toString('hex');

    res.status(200).json({ iv: iv.toString('hex'), content: encrypted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Encryption error' });
  }
}