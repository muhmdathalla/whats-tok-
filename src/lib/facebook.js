import * as btch from 'btch-downloader';
import axios from 'axios';

/**
 * Download Facebook Video / Reels
 * @param {string} url - Facebook video / reels URL
 */
export async function downloadFacebook(url) {
  // Method 1: btch-downloader fbdown
  try {
    const data = await btch.fbdown(url);
    const videoUrl = data?.Normal_video || data?.HD || data?.video || data?.url;
    if (videoUrl) {
      return {
        type: 'video',
        title: data.title || 'Facebook Video',
        videoUrl,
        audio: data.audio
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
          videoUrl: match[1]
        };
      }
    }
  } catch (err) {
    console.warn('[Facebook] SnapSave fallback gagal:', err.message);
  }

  throw new Error('Gagal mendownload video Facebook. Pastikan video publik dan bukan di grup tertutup.');
}
