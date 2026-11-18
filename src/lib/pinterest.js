import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Download Pinterest Media (HD Image / Video) with multiple resolutions
 * @param {string} rawUrl - Pinterest Pin URL or pin.it shortlink
 */
export async function downloadPinterest(rawUrl) {
  try {
    let targetUrl = rawUrl;

    // Follow redirect jika link berupa shortlink pin.it
    if (rawUrl.includes('pin.it')) {
      const redirectRes = await axios.get(rawUrl, {
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });
      targetUrl = redirectRes.request.res.responseUrl || rawUrl;
    }

    const res = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });

    const $ = cheerio.load(res.data);

    const title = $('meta[property="og:title"]').attr('content') || $('title').text() || 'Pinterest Media';
    const ogVideo = $('meta[property="og:video"]').attr('content') || $('meta[name="twitter:player:stream"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');

    // Cek apakah ada video
    if (ogVideo) {
      return {
        type: 'video',
        title: title.replace(' | Pinterest', '').trim(),
        videoUrl: ogVideo,
        thumbnail: ogImage,
        formats: [
          {
            label: 'Pinterest Video (Original MP4)',
            quality: 'HD Original',
            type: 'video',
            ext: 'mp4',
            url: ogVideo
          },
          ...(ogImage ? [{
            label: 'Cover Artwork (HD)',
            quality: 'HD',
            type: 'image',
            ext: 'jpg',
            url: ogImage
          }] : [])
        ]
      };
    }

    // Jika gambar, sediakan beberapa pilihan resolusi
    if (ogImage) {
      const hdOriginal = ogImage.replace(/\/\d+x\//, '/originals/');
      const std736 = ogImage.replace(/\/\d+x\//, '/736x/');
      const medium474 = ogImage.replace(/\/\d+x\//, '/474x/');

      const formats = [
        {
          label: 'Ultra HD Resolution (Originals)',
          quality: 'Original 4K/HD',
          type: 'image',
          ext: 'jpg',
          url: hdOriginal
        },
        {
          label: 'High Resolution (736px)',
          quality: '736px',
          type: 'image',
          ext: 'jpg',
          url: std736
        },
        {
          label: 'Mobile Compact (474px)',
          quality: '474px',
          type: 'image',
          ext: 'jpg',
          url: medium474
        }
      ];

      return {
        type: 'image',
        title: title.replace(' | Pinterest', '').trim(),
        imageUrl: hdOriginal,
        thumbnail: ogImage,
        formats
      };
    }

    throw new Error('Tidak dapat menemukan media pada pin Pinterest ini.');
  } catch (err) {
    throw new Error(`Gagal mendownload Pinterest: ${err.message}`);
  }
}
