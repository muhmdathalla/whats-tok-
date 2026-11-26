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
 * Extract YouTube / YouTube Music video ID
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|(?:www\.|m\.|music\.)?youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
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
 * Helper to get configured Ytdl client instance
 * Supports YOUTUBE_COOKIE environment variable to bypass datacenter/Vercel bot check
 */
export function getYtdlInstance() {
  const cookie = process.env.YOUTUBE_COOKIE || undefined;
  return new Ytdl({
    clients: [Client.VisionOS],
    ...(cookie ? { cookie } : {})
  });
}

/**
 * Download YouTube / YouTube Music video & audio formats and streams
 * @param {string} url - YouTube URL
 */
export async function downloadYouTube(url) {
  const cleanId = extractYouTubeId(url);
  const normalizedUrl = cleanId ? `https://www.youtube.com/watch?v=${cleanId}` : url;
  const isYouTubeMusic = url.includes('music.youtube.com');

  // Primary: @distube/ytdl-core with VisionOS (needs no player cipher)
  try {
    const ytdl = getYtdlInstance();

    const info = await ytdl.getInfo(normalizedUrl);
    const details = info.videoDetails || {};

    const title = details.title || 'YouTube Audio / Video';
    const author = details.author?.name || details.ownerChannelName || 'YouTube Artist';
    const duration = formatDuration(Number(details.lengthSeconds));
    const thumbnail = details.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`;

    // Progressive format (video + audio in one stream)
    const progFormat = info.formats.find(f => f.hasVideo && f.hasAudio);
    // Audio-only format
    const audioFormat = info.formats.find(f => f.hasAudio && !f.hasVideo);

    const baseMusicUrl = `/api/stream/music?url=${encodeURIComponent(normalizedUrl)}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(author)}`;

    // Build comprehensive format & resolution list for Web UI
    const formats = [];
    const seenQualities = new Set();

    // 1. Audio Formats (MP3 320k, 128k, WAV Lossless, FLAC Hi-Res, M4A)
    formats.push({
      label: 'Studio Master Audio (320kbps MP3)',
      quality: '320kbps',
      type: 'audio',
      ext: 'mp3',
      url: `${baseMusicUrl}&format=mp3&bitrate=320k`
    });

    formats.push({
      label: 'Standard Quality Audio (128kbps MP3)',
      quality: '128kbps',
      type: 'audio',
      ext: 'mp3',
      url: `${baseMusicUrl}&format=mp3&bitrate=128k`
    });

    formats.push({
      label: 'Lossless Audio (WAV 16-bit Uncompressed)',
      quality: 'WAV Lossless',
      type: 'audio',
      ext: 'wav',
      url: `${baseMusicUrl}&format=wav`
    });

    formats.push({
      label: 'Hi-Res Lossless Audio (FLAC 24-bit)',
      quality: 'FLAC Hi-Res',
      type: 'audio',
      ext: 'flac',
      url: `${baseMusicUrl}&format=flac`
    });

    formats.push({
      label: 'Native AAC Audio (M4A)',
      quality: 'M4A',
      type: 'audio',
      ext: 'm4a',
      url: `${baseMusicUrl}&format=m4a`
    });

    // 2. Progressive format (Combined Audio + Video) if video
    if (progFormat && !isYouTubeMusic) {
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

    // 3. High Resolution Video Formats (1080p, 720p, 480p, etc.) if video
    if (!isYouTubeMusic) {
      const videoFormats = info.formats.filter(f => f.hasVideo && f.container === 'mp4');
      for (const f of videoFormats) {
        if (f.qualityLabel && !seenQualities.has(f.qualityLabel)) {
          seenQualities.add(f.qualityLabel);
          formats.push({
            label: `${f.qualityLabel} Video Stream`,
            quality: f.qualityLabel,
            type: 'video',
            ext: 'mp4',
            itag: f.itag,
            url: `/api/stream/youtube?url=${encodeURIComponent(normalizedUrl)}&itag=${f.itag}`
          });
        }
      }
    }

    // 4. High-Res Thumbnail Artworks
    if (cleanId) {
      formats.push({
        label: 'Cover Artwork (MaxRes HD)',
        quality: '1080p',
        type: 'image',
        ext: 'jpg',
        url: `https://i.ytimg.com/vi/${cleanId}/maxresdefault.jpg`
      });
    }

    return {
      type: isYouTubeMusic ? 'audio' : 'video',
      title,
      author,
      duration,
      thumbnail,
      cover: thumbnail,
      downloadUrl: `${baseMusicUrl}&format=mp3&bitrate=320k`,
      videoUrl: `/api/stream/youtube?url=${encodeURIComponent(normalizedUrl)}`,
      musicUrl: `${baseMusicUrl}&format=mp3&bitrate=320k`,
      directUrl: progFormat?.url,
      formats,
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
    const baseMusicUrl = `/api/stream/music?url=${encodeURIComponent(normalizedUrl)}&title=${encodeURIComponent(oembed.title || 'audio')}`;
    return {
      type: isYouTubeMusic ? 'audio' : 'video',
      title: oembed.title || 'YouTube Media',
      author: oembed.author_name || 'YouTube Artist',
      thumbnail: oembed.thumbnail_url || `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`,
      cover: oembed.thumbnail_url || `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`,
      videoUrl: `/api/stream/youtube?url=${encodeURIComponent(normalizedUrl)}`,
      musicUrl: `${baseMusicUrl}&format=mp3&bitrate=320k`,
      downloadUrl: `${baseMusicUrl}&format=mp3&bitrate=320k`,
      formats: [
        {
          label: 'Studio Master Audio (320kbps MP3)',
          quality: '320kbps',
          type: 'audio',
          ext: 'mp3',
          url: `${baseMusicUrl}&format=mp3&bitrate=320k`
        },
        {
          label: 'Standard Audio (128kbps MP3)',
          quality: '128kbps',
          type: 'audio',
          ext: 'mp3',
          url: `${baseMusicUrl}&format=mp3&bitrate=128k`
        },
        {
          label: 'Lossless Audio (WAV)',
          quality: 'WAV',
          type: 'audio',
          ext: 'wav',
          url: `${baseMusicUrl}&format=wav`
        },
        {
          label: 'Hi-Res Lossless (FLAC)',
          quality: 'FLAC',
          type: 'audio',
          ext: 'flac',
          url: `${baseMusicUrl}&format=flac`
        },
        {
          label: 'HQ Cover Artwork',
          quality: 'HQ',
          type: 'image',
          ext: 'jpg',
          url: oembed.thumbnail_url || `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`
        }
      ]
    };
  }

  throw new Error('Gagal mengekstrak media dari YouTube. Pastikan link video valid dan publik.');
}
