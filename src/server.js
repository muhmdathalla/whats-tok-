import express from 'express';
import cors from 'cors';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { Ytdl, Client, SearchType } from '@distube/ytdl-core';
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
 * GET /api/stream/youtube
 * Direct media streaming for YouTube videos and audio tracks
 */
app.get('/api/stream/youtube', async (req, res) => {
  const { url, audio, download, filename, itag } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  try {
    const ytdl = new Ytdl({ clients: [Client.WebEmbedded, Client.Tv] });
    const info = await ytdl.getInfo(url);
    const isAudioOnly = audio === '1' || audio === 'true';

    let format;
    if (itag) {
      format = info.formats.find(f => f.itag === Number(itag));
    }

    if (!format) {
      const progFormat = info.formats.find(f => f.hasVideo && f.hasAudio);
      const audioFormat = info.formats.find(f => f.hasAudio && !f.hasVideo);
      format = isAudioOnly ? audioFormat : (progFormat || info.formats.find(f => f.hasVideo));
    }

    if (!format) {
      return res.status(404).send('No compatible stream format found');
    }

    const title = (info.videoDetails?.title || 'youtube_media').replace(/[^\w\s-]/gi, '').slice(0, 50).trim();
    const ext = format.hasVideo ? 'mp4' : 'mp3';
    const fname = filename || `${title}.${ext}`;

    const mime = format.mimeType?.split(';')[0] || (format.hasVideo ? 'video/mp4' : 'audio/mp4');
    res.setHeader('Content-Type', mime);
    if (download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fname)}"`);
    }

    const stream = ytdl.download(info, {
      filter: f => f.itag === format.itag
    });

    stream.on('error', (err) => {
      console.error('[YouTube Stream Error]:', err.message);
      if (!res.headersSent) res.status(500).send('Streaming error: ' + err.message);
    });

    req.on('close', () => {
      stream.destroy();
    });

    stream.pipe(res);
  } catch (err) {
    console.error('[YouTube Stream Route Error]:', err.message);
    if (!res.headersSent) res.status(500).send('Failed to stream: ' + err.message);
  }
});

/**
 * GET /api/stream/spotify
 * Direct audio streaming for Spotify tracks via high-quality audio stream
 */
app.get('/api/stream/spotify', async (req, res) => {
  const { q, title, artist, download } = req.query;
  const searchQuery = q || `${artist || ''} ${title || ''}`.trim() || 'Rick Astley Never Gonna Give You Up';

  try {
    const ytdl = new Ytdl({ clients: [Client.WebEmbedded, Client.Tv] });
    const results = await ytdl.search(searchQuery, { type: SearchType.Video });
    if (!results || results.length === 0 || !results[0].url) {
      return res.status(404).send('Spotify audio track match not found');
    }

    const matchedUrl = results[0].url;
    const info = await ytdl.getInfo(matchedUrl);
    const audioFormat = info.formats.find(f => f.hasAudio && !f.hasVideo) || info.formats.find(f => f.hasAudio);

    if (!audioFormat) {
      return res.status(404).send('Audio stream not available');
    }

    const fname = `${artist ? artist + ' - ' : ''}${title || 'track'}.mp3`.replace(/[^\w\s-.]/gi, '');
    res.setHeader('Content-Type', 'audio/mpeg');
    if (download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fname)}"`);
    }

    const stream = ytdl.download(info, {
      filter: f => f.itag === audioFormat.itag
    });

    stream.on('error', err => {
      console.error('[Spotify Stream Error]:', err.message);
      if (!res.headersSent) res.status(500).send('Streaming error: ' + err.message);
    });

    req.on('close', () => {
      stream.destroy();
    });

    stream.pipe(res);
  } catch (err) {
    console.error('[Spotify Stream Route Error]:', err.message);
    if (!res.headersSent) res.status(500).send('Failed to stream audio: ' + err.message);
  }
});

/**
 * GET /api/proxy
 * Safe download proxy to force download / bypass CORS on client side
 */
app.get('/api/proxy', async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  // Handle internal stream routes
  if (url.startsWith('/api/stream/youtube')) {
    const sep = url.includes('?') ? '&' : '?';
    return res.redirect(`${url}${sep}download=1&filename=${encodeURIComponent(filename || 'youtube_video.mp4')}`);
  }

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
