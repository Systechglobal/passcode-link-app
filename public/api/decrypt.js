// api/decrypt.js
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { iv, content, passcode } = req.body || {};
  if (!iv || !content || !passcode) return res.status(400).json({ error: 'iv, content, passcode required' });

  try {
    const algorithm = 'aes-256-ctr';
    const key = crypto.createHash('sha256').update(passcode).digest();
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(content, 'hex')), decipher.final()]).toString('utf8');

    res.status(200).json({ message: decrypted });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Decryption failed' });
  }
}