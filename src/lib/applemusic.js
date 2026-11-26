import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Clean & parse Apple Music title and artist from og:title string
 * e.g. "Blinding Lights by The Weeknd on Apple Music" -> { title: "Blinding Lights", artist: "The Weeknd" }
 */
function parseAppleTitle(raw) {
  if (!raw) return { title: 'Apple Music Track', artist: 'Unknown Artist' };
  let clean = raw.replace(/\s+on Apple\s*Music$/i, '').trim();

  // Pattern: "Title by Artist"
  const byMatch = clean.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { title: byMatch[1].trim(), artist: byMatch[2].trim() };
  }

  // Pattern: "Title - Artist"
  const dashMatch = clean.match(/^(.+?)\s+-\s+(.+)$/i);
  if (dashMatch) {
    return { title: dashMatch[1].trim(), artist: dashMatch[2].trim() };
  }

  return { title: clean, artist: 'Apple Music' };
}

/**
 * Download Apple Music track metadata and generate quality choices
 * @param {string} url - Apple Music track/album URL
 */
export async function downloadAppleMusic(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 12000
    });

    const $ = cheerio.load(res.data);
    const rawTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    const desc = $('meta[property="og:description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';

    const { title, artist } = parseAppleTitle(rawTitle);
    const cover = ogImage ? ogImage.replace(/\/\d+x\d+[^.]*\./, '/1200x1200bb.') : ogImage;

    const query = encodeURIComponent(`${artist} - ${title}`);
    const baseStreamUrl = `/api/stream/music?q=${query}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;

    const formats = [
      {
        label: 'Studio Master Audio (320kbps MP3)',
        quality: '320kbps',
        type: 'audio',
        ext: 'mp3',
        url: `${baseStreamUrl}&format=mp3&bitrate=320k`
      },
      {
        label: 'Standard Quality Audio (128kbps MP3)',
        quality: '128kbps',
        type: 'audio',
        ext: 'mp3',
        url: `${baseStreamUrl}&format=mp3&bitrate=128k`
      },
      {
        label: 'Lossless Audio (WAV 16-bit Uncompressed)',
        quality: 'WAV Lossless',
        type: 'audio',
        ext: 'wav',
        url: `${baseStreamUrl}&format=wav`
      },
      {
        label: 'Hi-Res Lossless Audio (FLAC 24-bit)',
        quality: 'FLAC Hi-Res',
        type: 'audio',
        ext: 'flac',
        url: `${baseStreamUrl}&format=flac`
      },
      {
        label: 'Native AAC Stream (256kbps M4A)',
        quality: 'AAC 256k',
        type: 'audio',
        ext: 'm4a',
        url: `${baseStreamUrl}&format=m4a`
      }
    ];

    if (cover) {
      formats.push({
        label: 'Apple Music Master Artwork (Original HD)',
        quality: 'Original HD',
        type: 'image',
        ext: 'jpg',
        url: cover
      });
    }

    return {
      type: 'audio',
      title,
      artist,
      desc,
      cover,
      thumbnail: cover,
      downloadUrl: `${baseStreamUrl}&format=mp3&bitrate=320k`,
      fileName: `${artist} - ${title}.mp3`,
      formats
    };
  } catch (err) {
    console.warn('[Apple Music Error]:', err.message);
    throw new Error('Gagal mengekstrak musik dari Apple Music. Pastikan link lagu publik dan valid.');
  }
}
