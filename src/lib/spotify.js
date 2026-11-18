import spotty from 'spottydl';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Download Spotify Track / Music MP3 with metadata
 * @param {string} url - Spotify Track URL
 */
export async function downloadSpotify(url) {
  // Method 1: SpottyDL (ekstrak metadata + audio)
  try {
    const trackInfo = await spotty.getTrack(url);
    if (trackInfo && trackInfo.title) {
      const tempDir = path.resolve('./temp_audio');
      fs.mkdirSync(tempDir, { recursive: true });

      const downloadResult = await spotty.downloadTrack(trackInfo, tempDir);
      
      // Cari file mp3 yang dihasilkan di tempDir
      const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.mp3'));
      if (files.length > 0) {
        const filePath = path.join(tempDir, files[0]);
        const audioBuffer = fs.readFileSync(filePath);
        
        // Bersihkan temp
        fs.unlinkSync(filePath);

        return {
          title: trackInfo.title,
          artist: trackInfo.artist || 'Unknown Artist',
          album: trackInfo.album || 'Spotify Music',
          year: trackInfo.year,
          cover: trackInfo.albumCoverURL,
          buffer: audioBuffer,
          fileName: `${trackInfo.artist} - ${trackInfo.title}.mp3`
        };
      }
    }
  } catch (err) {
    console.warn('[Spotify] spottydl gagal, mencoba fallback API:', err.message);
  }

  // Method 2: Public Spotify to MP3 API fallback
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(url)}`, {
      timeout: 25000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (res.data?.status && res.data?.data) {
      const data = res.data.data;
      const downloadUrl = data.download || data.url || data.audio;
      if (downloadUrl) {
        return {
          title: data.name || data.title || 'Spotify Track',
          artist: data.artist || 'Artist',
          album: data.album || 'Spotify Music',
          cover: data.image || data.cover,
          downloadUrl,
          fileName: `${data.artist || 'Artist'} - ${data.name || 'Song'}.mp3`
        };
      }
    }
  } catch (err) {
    console.warn('[Spotify] Siputzx fallback gagal:', err.message);
  }

  throw new Error('Gagal mengunduh musik dari Spotify. Pastikan link lagu Spotify valid.');
}
