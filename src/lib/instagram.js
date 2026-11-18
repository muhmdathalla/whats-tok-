import { instagram } from '@jerrycoder/instagram-api';
import * as btch from 'btch-downloader';

/**
 * Download Instagram Media (Single Photo, Carousel Multi-photo, Reels/Video)
 * with individual resolution and format selection
 */
export async function downloadInstagram(rawUrl) {
  // Bersihkan query string parameter (misal: ?igsh=... atau ?mdxt=...)
  const cleanUrl = rawUrl.split('?')[0];

  // Method 1: @jerrycoder/instagram-api (Sangat stabil untuk Carousel Multi-photo & Reels)
  try {
    const res = await instagram(cleanUrl).catch(() => instagram(rawUrl));
    if (res) {
      const items = [];

      // Jika response berupa Object dengan properti media_url_1, media_url_2, dst.
      if (typeof res === 'object' && !Array.isArray(res)) {
        if (res.url) {
          items.push({
            type: res.url.includes('.mp4') || res.type === 'video' ? 'video' : 'image',
            url: res.url
          });
        }

        const totalMedia = res.total_media || 20;
        for (let i = 1; i <= totalMedia; i++) {
          const mUrl = res[`media_url_${i}`];
          if (mUrl && !items.some(it => it.url === mUrl)) {
            items.push({
              type: mUrl.includes('.mp4') ? 'video' : 'image',
              url: mUrl
            });
          }
        }
      } else if (Array.isArray(res) && res.length > 0) {
        for (const item of res) {
          const link = typeof item === 'string' ? item : (item.url || item.downloadUrl);
          if (link && !items.some(it => it.url === link)) {
            items.push({
              type: link.includes('.mp4') || item.type === 'video' ? 'video' : 'image',
              url: link
            });
          }
        }
      }

      if (items.length > 0) {
        const hasVideo = items.some(i => i.type === 'video');
        const hasImage = items.some(i => i.type === 'image');
        let overallType = 'image';
        if (hasVideo && hasImage) overallType = 'mixed';
        else if (hasVideo) overallType = 'video';
        else overallType = 'images';

        const formats = [];
        items.forEach((item, idx) => {
          if (item.type === 'video') {
            formats.push({
              label: items.length > 1 ? `Reels Video #${idx + 1} (Original MP4)` : 'High-Quality Video (Original MP4)',
              quality: 'HD Original',
              type: 'video',
              ext: 'mp4',
              url: item.url
            });
          } else {
            formats.push({
              label: items.length > 1 ? `Carousel Photo #${idx + 1} (Original)` : 'High-Resolution Photo',
              quality: 'Original HD',
              type: 'image',
              ext: 'jpg',
              url: item.url
            });
          }
        });

        const firstVideo = items.find(i => i.type === 'video');
        const firstImage = items.find(i => i.type === 'image');

        return {
          type: overallType,
          caption: 'Instagram Media',
          items: items.slice(0, 20),
          videoUrl: firstVideo?.url,
          imageUrl: firstImage?.url,
          images: items.filter(i => i.type === 'image').map(i => i.url),
          formats
        };
      }
    }
  } catch (err) {
    console.warn('[Instagram] jerrycoder API gagal, mencoba btch-downloader:', err.message);
  }

  // Method 2: btch-downloader igdl fallback
  try {
    const rawData = await btch.igdl(cleanUrl).catch(() => btch.igdl(rawUrl));
    const mediaList = Array.isArray(rawData) ? rawData : (rawData?.result || rawData?.data || (rawData?.url ? [rawData] : []));

    if (Array.isArray(mediaList) && mediaList.length > 0) {
      const seenUrls = new Set();
      const items = [];

      for (const item of mediaList) {
        const link = typeof item === 'string' ? item : (item.url || item.downloadUrl || item.link);
        if (link && !seenUrls.has(link)) {
          seenUrls.add(link);
          const isVideo = item.type === 'video' || link.includes('.mp4') || link.includes('video');
          items.push({
            type: isVideo ? 'video' : 'image',
            url: link
          });
        }
      }

      if (items.length > 0) {
        const finalItems = items.slice(0, 20);
        const hasVideo = finalItems.some(i => i.type === 'video');
        const hasImage = finalItems.some(i => i.type === 'image');
        let overallType = 'image';
        if (hasVideo && hasImage) overallType = 'mixed';
        else if (hasVideo) overallType = 'video';
        else overallType = 'images';

        const formats = finalItems.map((item, idx) => ({
          label: item.type === 'video' ? `Instagram Video #${idx + 1}` : `Instagram Photo #${idx + 1}`,
          quality: 'Original',
          type: item.type,
          ext: item.type === 'video' ? 'mp4' : 'jpg',
          url: item.url
        }));

        const firstVideo = finalItems.find(i => i.type === 'video');
        const firstImage = finalItems.find(i => i.type === 'image');

        return {
          type: overallType,
          caption: rawData?.caption || rawData?.title || 'Instagram Media',
          items: finalItems,
          videoUrl: firstVideo?.url,
          imageUrl: firstImage?.url,
          images: finalItems.filter(i => i.type === 'image').map(i => i.url),
          formats
        };
      }
    }
  } catch (err) {
    console.warn('[Instagram] btch-downloader igdl gagal:', err.message);
  }

  throw new Error('Gagal mengekstrak media dari link Instagram. Pastikan akun tidak diprivate.');
}
