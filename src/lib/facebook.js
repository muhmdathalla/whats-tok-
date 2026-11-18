import * as btch from 'btch-downloader';
import axios from 'axios';

/**
 * Download Facebook Video / Reels with multiple resolution options
 * @param {string} url - Facebook video / reels URL
 */
export async function downloadFacebook(url) {
  // Method 1: btch-downloader fbdown
  try {
    const data = await btch.fbdown(url);
    const hd = data?.HD;
    const normal = data?.Normal_video || data?.video || data?.url;

    if (hd || normal) {
      const formats = [];
      if (hd) {
        formats.push({
          label: 'HD High Definition Video (720p/1080p)',
          quality: 'HD',
          type: 'video',
          ext: 'mp4',
          url: hd
        });
      }
      if (normal) {
        formats.push({
          label: 'SD Standard Definition Video (360p)',
          quality: 'SD',
          type: 'video',
          ext: 'mp4',
          url: normal
        });
      }
      if (data.audio) {
        formats.push({
          label: 'Extracted Audio Track (MP3)',
          quality: 'Original',
          type: 'audio',
          ext: 'mp3',
          url: data.audio
        });
      }

      return {
        type: 'video',
        title: data.title || 'Facebook Video',
        videoUrl: hd || normal,
        audio: data.audio,
        formats
      };
    }
  } catch (err) {
    console.warn('[Facebook] btch-downloader gagal, mencoba fallback:', err.message);
  }

  // Method 2: Public SnapSave / FB scraper fallback
  try {
    const res = await axios.post('https://snapsave.app/action.php?lang=en', new URLSearchParams({
      url
    }), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });

    if (res.data) {
      const match = res.data.match(/href="([^"]+)"[^>]*class="[^"]*button is-success/i);
      if (match && match[1]) {
        return {
          type: 'video',
          title: 'Facebook Video',
          videoUrl: match[1],
          formats: [
            {
              label: 'Facebook Video (MP4)',
              quality: 'HD',
              type: 'video',
              ext: 'mp4',
              url: match[1]
            }
          ]
        };
      }
    }
  } catch (err) {
    console.warn('[Facebook] SnapSave fallback gagal:', err.message);
  }

  throw new Error('Gagal mendownload video Facebook. Pastikan video publik dan bukan di grup tertutup.');
}
