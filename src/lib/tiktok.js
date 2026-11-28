import axios from 'axios';
import { Downloader } from '@tobyg74/tiktok-api-dl';
import * as btch from 'btch-downloader';
import * as scrapr from '@coflyn/scrapr';

/**
 * Resolve shortened TikTok links (vt.tiktok.com, vm.tiktok.com) to canonical URLs
 */
async function resolveTikTokUrl(rawUrl) {
  if (rawUrl.includes('vt.tiktok.com') || rawUrl.includes('vm.tiktok.com') || rawUrl.includes('/t/')) {
    try {
      const res = await axios.get(rawUrl, {
        maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 8000
      });
      return res.request?.res?.responseUrl || res.config?.url || rawUrl;
    } catch {
      return rawUrl;
    }
  }
  return rawUrl;
}

/**
 * Download TikTok media (Video or Photo Slides) with multiple resolution & format options
 * @param {string} rawUrl - TikTok URL
 */
export async function downloadTikTok(rawUrl) {
  const url = await resolveTikTokUrl(rawUrl);

  // Method 1: @coflyn/scrapr providers (tiktokio, tikdownloader, ssstik, snaptik)
  if (scrapr && scrapr.tiktok) {
    const providers = [scrapr.tiktok.tiktokio, scrapr.tiktok.tikdownloader, scrapr.tiktok.ssstik, scrapr.tiktok.snaptik];
    for (const provider of providers) {
      if (typeof provider !== 'function') continue;
      try {
        const res = await provider(url);
        if (res && res.status) {
          const videoUrl = res.video || res.play || res.download || res.nowm || res.downloads?.[0]?.url;
          const audioUrl = res.audio || res.music || res.audioUrl;
          const title = res.title || res.desc || 'TikTok Media';
          const author = res.author || res.nickname || 'Creator';
          const cover = res.cover || res.thumbnail;

          // Check for images/slide
          if (Array.isArray(res.images) && res.images.length > 0) {
            const formats = res.images.map((img, idx) => ({
              label: `Photo Slide #${idx + 1} (Full HD)`,
              quality: 'Original HD',
              type: 'image',
              ext: 'jpg',
              url: img
            }));
            if (audioUrl) {
              formats.push({
                label: 'Original Audio Track (MP3)',
                quality: 'Original',
                type: 'audio',
                ext: 'mp3',
                url: audioUrl
              });
            }
            return {
              type: 'images',
              title,
              author,
              images: res.images,
              count: res.images.length,
              musicUrl: audioUrl,
              thumbnail: cover,
              formats
            };
          }

          if (videoUrl) {
            const formats = [
              {
                label: 'HD Video (No Watermark)',
                quality: 'HD',
                type: 'video',
                ext: 'mp4',
                url: videoUrl
              },
              ...(audioUrl ? [{
                label: 'Background Audio Track (MP3)',
                quality: 'Original',
                type: 'audio',
                ext: 'mp3',
                url: audioUrl
              }] : []),
              ...(cover ? [{
                label: 'Cover Thumbnail',
                quality: 'HD',
                type: 'image',
                ext: 'jpg',
                url: cover
              }] : [])
            ];

            return {
              type: 'video',
              title,
              author,
              videoUrl,
              musicUrl: audioUrl,
              thumbnail: cover,
              formats
            };
          }
        }
      } catch (err) {
        // Try next provider
      }
    }
  }

  // Method 2: TikWM API (sangat stabil untuk slide foto dan video no-watermark)
  try {
    const res = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({
      url: url,
      hd: '1'
    }), {
      headers: {
        'Accept': 'application/json',
        'Cookie': 'current_language=en',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Mobile Safari/537.36'
      },
      timeout: 15000
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
