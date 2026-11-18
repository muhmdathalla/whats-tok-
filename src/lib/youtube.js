import { Ytdl, Client } from '@distube/ytdl-core';
import axios from 'axios';

/**
 * Format seconds to readable duration (mm:ss or hh:mm:ss)
 */
function formatDuration(sec) {
  if (!sec || isNaN(sec)) return undefined;
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

/**
 * Extract YouTube video ID
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  return match ? match[1] : null;
}

/**
 * Fetch video info via YouTube oEmbed (fast, reliable metadata)
 */
async function fetchOEmbedInfo(url) {
  try {
    const res = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      timeout: 5000
    });
    return res.data;
  } catch {
    return null;
  }
}

/**
 * Download YouTube video / shorts info, formats, and streams
 * @param {string} url - YouTube URL
 */
export async function downloadYouTube(url) {
  const cleanId = extractYouTubeId(url);
  const normalizedUrl = cleanId ? `https://www.youtube.com/watch?v=${cleanId}` : url;

  // Primary: @distube/ytdl-core with WebEmbedded & Tv clients
  try {
    const ytdl = new Ytdl({
      clients: [Client.WebEmbedded, Client.Tv]
    });

    const info = await ytdl.getInfo(normalizedUrl);
    const details = info.videoDetails || {};

    const title = details.title || 'YouTube Video';
    const author = details.author?.name || details.ownerChannelName || 'YouTube Channel';
    const duration = formatDuration(Number(details.lengthSeconds));
    const thumbnail = details.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`;

    // Progressive format (video + audio in one stream)
    const progFormat = info.formats.find(f => f.hasVideo && f.hasAudio);
    // Audio-only format
    const audioFormat = info.formats.find(f => f.hasAudio && !f.hasVideo);

    // Build comprehensive format & resolution list for Web UI
    const formats = [];
    const seenQualities = new Set();

    // 1. Progressive format (Combined Audio + Video)
    if (progFormat) {
      seenQualities.add(progFormat.qualityLabel || '360p');
      formats.push({
        label: `${progFormat.qualityLabel || '360p'} Standard (Video + Audio)`,
        quality: progFormat.qualityLabel || '360p',
        type: 'video',
        ext: 'mp4',
        itag: progFormat.itag,
        url: `/api/stream/youtube?url=${encodeURIComponent(normalizedUrl)}&itag=${progFormat.itag}`
      });
    }

    // 2. High Resolution Video Formats (1080p, 720p, 480p, etc.)
    const videoFormats = info.formats.filter(f => f.hasVideo && f.container === 'mp4');
    for (const f of videoFormats) {
      if (f.qualityLabel && !seenQualities.has(f.qualityLabel)) {
        seenQualities.add(f.qualityLabel);
        formats.push({
          label: `${f.qualityLabel} HD Stream`,
          quality: f.qualityLabel,
          type: 'video',
          ext: 'mp4',
          itag: f.itag,
          url: `/api/stream/youtube?url=${encodeURIComponent(normalizedUrl)}&itag=${f.itag}`
        });
      }
    }

    // 3. Audio Tracks & Bitrates (128kbps, 160kbps, etc.)
    const audioFormats = info.formats.filter(f => f.hasAudio && !f.hasVideo);
    const seenBitrates = new Set();
    for (const f of audioFormats) {
      const br = f.audioBitrate ? `${f.audioBitrate}kbps` : 'High';
      if (!seenBitrates.has(br)) {
        seenBitrates.add(br);
        formats.push({
          label: `Audio MP3 / M4A (${br})`,
          quality: br,
          type: 'audio',
          ext: 'mp3',
          itag: f.itag,
          url: `/api/stream/youtube?url=${encodeURIComponent(normalizedUrl)}&itag=${f.itag}&audio=1`
        });
      }
    }

    // 4. High-Res Thumbnail Artworks
    if (cleanId) {
      formats.push({
        label: 'Cover Thumbnail (MaxRes HD)',
        quality: '1080p',
        type: 'image',
        ext: 'jpg',
        url: `https://i.ytimg.com/vi/${cleanId}/maxresdefault.jpg`
      });
      formats.push({
        label: 'Cover Thumbnail (High Quality)',
        quality: '720p',
        type: 'image',
        ext: 'jpg',
        url: `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`
      });
    }

    return {
      type: 'video',
      title,
      author,
      duration,
      thumbnail,
      videoUrl: `/api/stream/youtube?url=${encodeURIComponent(normalizedUrl)}`,
      musicUrl: `/api/stream/youtube?url=${encodeURIComponent(normalizedUrl)}&audio=1`,
      directUrl: progFormat?.url,
      formats,
      // Helper functions for native server / bot streaming
      getStream: () => ytdl.download(info, {
        filter: f => (progFormat ? f.itag === progFormat.itag : (f.hasVideo && f.hasAudio))
      }),
      getAudioStream: () => ytdl.download(info, {
        filter: f => (audioFormat ? f.itag === audioFormat.itag : (f.hasAudio && !f.hasVideo))
      })
    };
  } catch (err) {
    console.warn('[YouTube] distube/ytdl-core getInfo warning:', err.message);
  }

  // Fallback: oEmbed metadata if ytdl is temporarily blocked
  const oembed = await fetchOEmbedInfo(normalizedUrl);
  if (oembed && cleanId) {
    return {
      type: 'video',
      title: oembed.title || 'YouTube Video',
      author: oembed.author_name || 'YouTube Channel',
      thumbnail: oembed.thumbnail_url || `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`,
      videoUrl: `/api/stream/youtube?url=${encodeURIComponent(normalizedUrl)}`,
      musicUrl: `/api/stream/youtube?url=${encodeURIComponent(normalizedUrl)}&audio=1`,
      formats: [
        {
          label: 'Default MP4 Video Stream',
          quality: '360p',
          type: 'video',
          ext: 'mp4',
          url: `/api/stream/youtube?url=${encodeURIComponent(normalizedUrl)}`
        },
        {
          label: 'Audio Track',
          quality: '128kbps',
          type: 'audio',
          ext: 'mp3',
          url: `/api/stream/youtube?url=${encodeURIComponent(normalizedUrl)}&audio=1`
        },
        {
          label: 'HQ Thumbnail',
          quality: 'HQ',
          type: 'image',
          ext: 'jpg',
          url: oembed.thumbnail_url || `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`
        }
      ]
    };
  }

  throw new Error('Gagal mengekstrak video dari YouTube. Pastikan link video valid dan publik.');
}
