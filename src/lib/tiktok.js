import axios from 'axios';
import { Downloader } from '@tobyg74/tiktok-api-dl';
import * as btch from 'btch-downloader';

/**
 * Download TikTok media (Video or Photo Slides) with multiple resolution & format options
 * @param {string} url - TikTok URL
 */
export async function downloadTikTok(url) {
  // Method 1: TikWM API (sangat stabil untuk slide foto dan video no-watermark)
  try {
    const res = await axios.post('https://tikwm.com/api/', new URLSearchParams({
      url: url,
      hd: '1'
    }), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 20000
    });

    if (res.data && res.data.code === 0 && res.data.data) {
      const data = res.data.data;
      const title = data.title || 'TikTok Media';
      const author = data.author?.nickname || data.author?.unique_id || 'Creator';
      const musicUrl = data.music || data.music_info?.play;
      const coverUrl = data.origin_cover || data.cover;

      // Cek apakah postingan berupa Photo Slide / Multi-foto
      if (Array.isArray(data.images) && data.images.length > 0) {
        const formats = data.images.map((img, idx) => ({
          label: `Photo Slide #${idx + 1} (Full HD)`,
          quality: 'Original HD',
          type: 'image',
          ext: 'jpg',
          url: img
        }));

        if (musicUrl) {
          formats.push({
            label: 'Original Audio Track (MP3)',
            quality: 'Original',
            type: 'audio',
            ext: 'mp3',
            url: musicUrl
          });
        }

        return {
          type: 'images',
          title,
          author,
          images: data.images,
          count: data.images.length,
          musicUrl,
          thumbnail: coverUrl,
          formats
        };
      }

      // Jika postingan berupa Video
      if (data.play || data.wmplay || data.hdplay) {
        const hdVideo = data.hdplay || data.play;
        const sdVideo = data.play || data.hdplay;

        const formats = [];
        if (data.hdplay) {
          formats.push({
            label: 'HD Video (No Watermark 1080p)',
            quality: '1080p HD',
            type: 'video',
            ext: 'mp4',
            url: data.hdplay
          });
        }
        if (sdVideo) {
          formats.push({
            label: 'Standard Video (No Watermark 720p)',
            quality: '720p',
            type: 'video',
            ext: 'mp4',
            url: sdVideo
          });
        }
        if (data.wmplay) {
          formats.push({
            label: 'Original Video (With Watermark)',
            quality: 'SD',
            type: 'video',
            ext: 'mp4',
            url: data.wmplay
          });
        }
        if (musicUrl) {
          formats.push({
            label: 'Background Audio Track (MP3)',
            quality: 'Original',
            type: 'audio',
            ext: 'mp3',
            url: musicUrl
          });
        }
        if (coverUrl) {
          formats.push({
            label: 'Cover Thumbnail (HD)',
            quality: 'HD',
            type: 'image',
            ext: 'jpg',
            url: coverUrl
          });
        }

        return {
          type: 'video',
          title,
          author,
          videoUrl: hdVideo || sdVideo,
          musicUrl,
          thumbnail: coverUrl,
          formats
        };
      }
    }
  } catch (err) {
    console.warn('[TikTok] TikWM gagal, mencoba metode alternatif:', err.message);
  }

  // Method 2: @tobyg74/tiktok-api-dl
  try {
    const dlResult = await Downloader(url, { version: 'v2' }).catch(() => Downloader(url, { version: 'v1' }));
    if (dlResult && dlResult.status === 'success' && dlResult.result) {
      const result = dlResult.result;
      const title = result.description || 'TikTok Media';
      const author = result.author?.nickname || result.author?.username || 'Creator';
      const musicUrl = result.music?.playUrl;

      if (result.type === 'image' && Array.isArray(result.images) && result.images.length > 0) {
        const formats = result.images.map((img, idx) => ({
          label: `Photo Slide #${idx + 1}`,
          quality: 'HD',
          type: 'image',
          ext: 'jpg',
          url: img
        }));
        if (musicUrl) {
          formats.push({
            label: 'Audio Track',
            quality: 'Original',
            type: 'audio',
            ext: 'mp3',
            url: musicUrl
          });
        }
        return {
          type: 'images',
          title,
          author,
          images: result.images,
          count: result.images.length,
          musicUrl,
          formats
        };
      }

      if (result.video) {
        const videoUrl = typeof result.video === 'string' ? result.video : (result.video.playAddr?.[0] || result.video.downloadAddr?.[0]);
        if (videoUrl) {
          return {
            type: 'video',
            title,
            author,
            videoUrl,
            musicUrl,
            formats: [
              {
                label: 'HD Video (No Watermark)',
                quality: 'HD',
                type: 'video',
                ext: 'mp4',
                url: videoUrl
              },
              ...(musicUrl ? [{
                label: 'Audio Track (MP3)',
                quality: 'Original',
                type: 'audio',
                ext: 'mp3',
                url: musicUrl
              }] : [])
            ]
          };
        }
      }
    }
  } catch (err) {
    console.warn('[TikTok] tiktok-api-dl gagal, mencoba btch:', err.message);
  }

  // Method 3: btch-downloader ttdl
  try {
    const data = await btch.ttdl(url);
    if (data && (data.video || data.video_nowm || data.play)) {
      const videoUrl = data.video_nowm || data.video || data.play;
      return {
        type: 'video',
        title: data.title || 'TikTok Video',
        author: data.author || 'Creator',
        videoUrl,
        musicUrl: data.audio,
        formats: [
          {
            label: 'Standard Video',
            quality: 'SD',
            type: 'video',
            ext: 'mp4',
            url: videoUrl
          },
          ...(data.audio ? [{
            label: 'Audio Track (MP3)',
            quality: 'Original',
            type: 'audio',
            ext: 'mp3',
            url: data.audio
          }] : [])
        ]
      };
    }
  } catch (err) {
    console.warn('[TikTok] btch-downloader gagal:', err.message);
  }

  throw new Error('Gagal mengekstrak media dari link TikTok yang diberikan.');
}
