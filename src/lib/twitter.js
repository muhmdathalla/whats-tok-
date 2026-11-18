import axios from 'axios';

/**
 * Download Twitter / X Media (Video, GIF, Photos)
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

    // Cek media (videos / photos)
    const media = tweet.media;
    if (!media) {
      throw new Error('Tidak ada media (foto/video) pada postingan tweet ini.');
    }

    // 1. Jika ada video
    if (media.videos && media.videos.length > 0) {
      const bestVideo = media.videos[0];
      return {
        type: 'video',
        title,
        author,
        videoUrl: bestVideo.url,
        thumbnail: bestVideo.thumbnail_url
      };
    }

    // 2. Jika ada foto
    if (media.photos && media.photos.length > 0) {
      const images = media.photos.map(p => p.url).filter(Boolean);
      return {
        type: 'images',
        title,
        author,
        images,
        count: images.length
      };
    }

    throw new Error('Format media tweet tidak didukung.');
  } catch (err) {
    throw new Error(`Gagal mendownload media Twitter/X: ${err.message}`);
  }
}
