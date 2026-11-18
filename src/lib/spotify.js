import spotty from 'spottydl';
import axios from 'axios';

/**
 * Download Spotify Track / Music MP3 with metadata and quality options
 * @param {string} url - Spotify Track URL
 */
export async function downloadSpotify(url) {
  // Method 1: SpottyDL (ekstrak metadata + cover)
  try {
    const trackInfo = await spotty.getTrack(url);
    if (trackInfo && trackInfo.title) {
      const title = trackInfo.title;
      const artist = trackInfo.artist || 'Unknown Artist';
      const album = trackInfo.album || 'Spotify Music';
      const cover = trackInfo.albumCoverURL;
      const query = encodeURIComponent(`${artist} - ${title}`);

      const streamUrl = `/api/stream/spotify?q=${query}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;

      const formats = [
        {
          label: 'Studio Master Audio (320kbps MP3)',
          quality: '320kbps',
          type: 'audio',
          ext: 'mp3',
          url: `${streamUrl}&quality=320`
        },
        {
          label: 'Standard Mobile Audio (128kbps MP3)',
          quality: '128kbps',
          type: 'audio',
          ext: 'mp3',
          url: `${streamUrl}&quality=128`
        }
      ];

      if (cover) {
        formats.push({
          label: 'Original Album Cover Artwork (640x640)',
          quality: 'HD',
          type: 'image',
          ext: 'jpg',
          url: cover
        });
      }

      return {
        type: 'audio',
        title,
        artist,
        album,
        year: trackInfo.year,
        cover,
        thumbnail: cover,
        downloadUrl: streamUrl,
        fileName: `${artist} - ${title}.mp3`,
        formats
      };
    }
  } catch (err) {
    console.warn('[Spotify] spottydl getTrack gagal, mencoba fallback:', err.message);
  }

  // Method 2: Spotify oEmbed metadata fallback
  try {
    const res = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
      timeout: 5000
    });
    if (res.data && res.data.title) {
      const rawTitle = res.data.title;
      const cover = res.data.thumbnail_url;
      const query = encodeURIComponent(rawTitle);
      const streamUrl = `/api/stream/spotify?q=${query}&title=${encodeURIComponent(rawTitle)}`;

      return {
        type: 'audio',
        title: rawTitle,
        artist: 'Spotify Artist',
        cover,
        thumbnail: cover,
        downloadUrl: streamUrl,
        fileName: `${rawTitle}.mp3`,
        formats: [
          {
            label: 'Audio Track (320kbps MP3)',
            quality: '320kbps',
            type: 'audio',
            ext: 'mp3',
            url: streamUrl
          },
          ...(cover ? [{
            label: 'Album Cover (HD)',
            quality: 'HD',
            type: 'image',
            ext: 'jpg',
            url: cover
          }] : [])
        ]
      };
    }
  } catch (err) {
    console.warn('[Spotify] oEmbed fallback gagal:', err.message);
  }

  throw new Error('Gagal mengunduh musik dari Spotify. Pastikan link lagu Spotify valid.');
}
