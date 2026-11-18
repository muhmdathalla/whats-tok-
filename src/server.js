import express from 'express';
import cors from 'cors';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { downloadMedia, detectPlatform } from './lib/downloader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../public')));

/**
 * Health check & supported platforms
 */
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Whats-Tok Universal Downloader',
    version: '2.0.0',
    platforms: ['tiktok', 'instagram', 'youtube', 'spotify', 'twitter', 'pinterest', 'facebook']
  });
});

/**
 * POST /api/download
 * Unified download endpoint
 */
app.post('/api/download', async (req, res) => {
  const { url, options } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'URL harus diisi.' });
  }

  const platform = detectPlatform(url);
  if (!platform) {
    return res.status(400).json({
      success: false,
      error: 'Platform tidak didukung. Masukkan link TikTok, Instagram, YouTube, Spotify, X/Twitter, Pinterest, atau Facebook.'
    });
  }

  try {
    const data = await downloadMedia(url, options);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error(`[API Error] (${platform}):`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/proxy
 * Safe download proxy to force download / bypass CORS on client side
 */
app.get('/api/proxy', async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  try {
    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });

    const fname = filename || 'downloaded_media';
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fname)}"`);
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }

    response.data.pipe(res);
  } catch (err) {
    res.status(500).send('Proxy download failed: ' + err.message);
  }
});

export function startWebServer() {
  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`🌐 Whats-Tok Web Platform berjalan di http://localhost:${PORT}`);
    });
  }
  return app;
}

// Run standalone if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startWebServer();
}

export default app;
