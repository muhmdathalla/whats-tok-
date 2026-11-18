import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Download Pinterest Media (HD Image / Video)
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
        videoUrl: ogVideo
      };
    }

    // Jika gambar, ubah resolusi ke originals (kualitas tertinggi)
    if (ogImage) {
      // Pinterest URL format: https://i.pinimg.com/736x/... -> https://i.pinimg.com/originals/...
      const hdImage = ogImage.replace(/\/\d+x\//, '/originals/');
      return {
        type: 'image',
        title: title.replace(' | Pinterest', '').trim(),
        imageUrl: hdImage,
        thumbnail: ogImage
      };
    }

    throw new Error('Tidak dapat menemukan media pada pin Pinterest ini.');
  } catch (err) {
    throw new Error(`Gagal mendownload Pinterest: ${err.message}`);
  }
}
