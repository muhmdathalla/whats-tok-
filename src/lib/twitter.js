import axios from 'axios';

/**
 * Download Twitter / X Media (Video, GIF, Photos) with quality options
 * @param {string} url - Twitter / X post URL
 */
export async function downloadTwitter(url) {
  const match = url.match(/(?:twitter|x)\.com\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i);
  if (!match) {
    throw new Error('Link Twitter/X tidak valid.');
  }

  const [, user, id] = match;

  try {
    const res = await axios.get(`https://api.fxtwitter.com/${user}/status/${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 15000
    });

    const tweet = res.data?.tweet;
    if (!tweet) {
      throw new Error('Tweet tidak ditemukan atau akun di-private.');
    }

    const title = tweet.text || 'Twitter / X Media';
    const author = `${tweet.author?.name || user} (@${tweet.author?.screen_name || user})`;

    const media = tweet.media;
    if (!media) {
      throw new Error('Tidak ada media (foto/video) pada postingan tweet ini.');
    }

    // 1. Jika ada video
    if (media.videos && media.videos.length > 0) {
      const bestVideo = media.videos[0];
      const formats = [];

      formats.push({
        label: 'High-Definition Video (MP4)',
        quality: 'HD Original',
        type: 'video',
        ext: 'mp4',
        url: bestVideo.url
      });

      if (bestVideo.thumbnail_url) {
        formats.push({
          label: 'Video Thumbnail Cover',
          quality: 'HD',
          type: 'image',
          ext: 'jpg',
          url: bestVideo.thumbnail_url
        });
      }

      return {
        type: 'video',
        title,
        author,
        videoUrl: bestVideo.url,
        thumbnail: bestVideo.thumbnail_url,
        formats
      };
    }

    // 2. Jika ada foto
    if (media.photos && media.photos.length > 0) {
      const images = media.photos.map(p => p.url).filter(Boolean);
      const formats = images.map((img, idx) => ({
        label: `Photo #${idx + 1} (Original Ultra HD)`,
        quality: 'Original HD',
        type: 'image',
        ext: 'jpg',
        url: img.includes('?') ? `${img}&name=orig` : `${img}?name=orig`
      }));

      return {
        type: 'images',
        title,
        author,
        images,
        count: images.length,
        formats
      };
    }

    throw new Error('Format media tweet tidak didukung.');
  } catch (err) {
    throw new Error(`Gagal mendownload media Twitter/X: ${err.message}`);
  }
}
