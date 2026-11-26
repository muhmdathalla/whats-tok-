import { downloadTikTok } from './lib/tiktok.js';
import { downloadInstagram } from './lib/instagram.js';
import { downloadYouTube } from './lib/youtube.js';
import { downloadSpotify } from './lib/spotify.js';
import { downloadAppleMusic } from './lib/applemusic.js';
import { downloadTwitter } from './lib/twitter.js';
import { downloadPinterest } from './lib/pinterest.js';
import { downloadFacebook } from './lib/facebook.js';
import { PATTERNS } from './lib/downloader.js';
import { delay, extractUrls, getBuffer } from './utils/helpers.js';
import { config } from './config.js';

/**
 * Handle incoming WhatsApp message
 */
export async function handleMessage(sock, m) {
  try {
    if (!m.message) return;

    const jid = m.key.remoteJid;
    if (!jid || jid === 'status@broadcast') return;

    // Filter grup
    const isGroup = jid.endsWith('@g.us');
    if (config.privateOnly && isGroup) return;

    // Identifikasi akun & deteksi apakah ini chat ke diri sendiri ("Message Yourself" / kontak You)
    const botPhone = sock.user?.id ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : '';
    const botLid = sock.user?.lid ? sock.user.lid.split(':')[0].replace(/[^0-9]/g, '') : '';
    const currentNum = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

    const isSelfChat = (botPhone && currentNum === botPhone) || (botLid && currentNum === botLid);

    // KETENTUAN UTAMA:
    // Jika onlySelf aktif (default: true), bot HANYA merespons chat di kontak You (diri sendiri).
    // Jadi kalau kirim link ke orang lain, bot TIDAK akan pernah ikut campur/download!
    if (config.onlySelf && !isSelfChat) {
      return;
    }

    // Jika pesan terkirim dari kita sendiri (fromMe), hanya proses jika kita kirim ke diri sendiri
    if (m.key.fromMe && !isSelfChat) {
      return;
    }

    // Ekstrak teks pesan
    const text =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      m.message.videoMessage?.caption ||
      '';

    if (!text || typeof text !== 'string') return;

    // Temukan semua URL dalam teks
    const urls = extractUrls(text);
    if (urls.length === 0) return;

    console.log(`📩 [Link Terdeteksi di Kontak You]: "${urls[0]}"`);

    // Deteksi opsi "audio/mp3 only"
    const isAudioOnly = /mp3|audio|lagu|musik/i.test(text);

    // Tujuan pengiriman harus selalu format @s.whatsapp.net (bukan internal @lid iOS)
    const targetJid = isSelfChat ? `${botPhone}@s.whatsapp.net` : (jid.endsWith('@lid') ? `${botPhone}@s.whatsapp.net` : jid);

    // Auto read
    if (config.autoRead) {
      await sock.readMessages([m.key]).catch(() => {});
    }

    for (const url of urls) {
      // 1. SPOTIFY (Music / Audio MP3)
      if (PATTERNS.SPOTIFY.test(url)) {
        await handleSpotify(sock, targetJid, url);
        break;
      }

      // 1b. APPLE MUSIC (Music / Audio MP3)
      if (PATTERNS.APPLE_MUSIC.test(url)) {
        await handleAppleMusic(sock, targetJid, url);
        break;
      }

      // 2. TIKTOK (Video, Photo Slides, Audio)
      if (PATTERNS.TIKTOK.test(url)) {
        await handleTikTok(sock, targetJid, url, isAudioOnly);
        break;
      }

      // 3. INSTAGRAM (Reels, Single Photo, Carousel Multi-photo)
      if (PATTERNS.INSTAGRAM.test(url)) {
        await handleInstagram(sock, targetJid, url);
        break;
      }

      // 4. TWITTER / X (Video, GIF, Photos)
      if (PATTERNS.TWITTER.test(url)) {
        await handleTwitter(sock, targetJid, url);
        break;
      }

      // 5. PINTEREST (HD Photo, Video Pin)
      if (PATTERNS.PINTEREST.test(url)) {
        await handlePinterest(sock, targetJid, url);
        break;
      }

      // 6. FACEBOOK (Reels, Video)
      if (PATTERNS.FACEBOOK.test(url)) {
        await handleFacebook(sock, targetJid, url);
        break;
      }

      // 7. YOUTUBE (Video, Shorts, MP3)
      if (PATTERNS.YOUTUBE.test(url)) {
        await handleYouTube(sock, targetJid, url, isAudioOnly);
        break;
      }
    }
  } catch (err) {
    console.error('[Handler Error]:', err);
  }
}

/**
 * Handler Spotify Music Downloader
 */
async function handleSpotify(sock, targetJid, url) {
  console.log(`[Spotify] Mengunduh lagu: ${url}`);
  try {
    const data = await downloadSpotify(url);

    // Kirim Cover Image + Info lagu
    if (data.cover) {
      await sock.sendMessage(targetJid, {
        image: { url: data.cover },
        caption: `🎵 *Spotify Music*\n📌 *Judul:* ${data.title}\n👤 *Artis:* ${data.artist}\n💿 *Album:* ${data.album || '-'}\n\n_Sedang mengirim file audio MP3..._`
      });
    }

    // Kirim Audio MP3
    if (data.buffer) {
      await sock.sendMessage(targetJid, {
        audio: data.buffer,
        mimetype: 'audio/mp4',
        fileName: data.fileName || `${data.title}.mp3`
      });
    } else if (data.downloadUrl) {
      await sock.sendMessage(targetJid, {
        audio: { url: data.downloadUrl },
        mimetype: 'audio/mp4',
        fileName: data.fileName || `${data.title}.mp3`
      });
    }

    console.log(`[Spotify] Sukses mengirim lagu: ${data.title}`);
  } catch (err) {
    console.error('[Spotify Error]:', err.message);
    await sock.sendMessage(targetJid, {
      text: `❌ *Gagal mendownload Spotify:*\n${err.message}`
    });
  }
}

/**
 * Handler Apple Music Downloader
 */
async function handleAppleMusic(sock, targetJid, url) {
  console.log(`[Apple Music] Mengunduh lagu: ${url}`);
  try {
    const data = await downloadAppleMusic(url);

    if (data.cover) {
      await sock.sendMessage(targetJid, {
        image: { url: data.cover },
        caption: `🍎 *Apple Music*\n📌 *Judul:* ${data.title}\n👤 *Artis:* ${data.artist}\n\n_Sedang mengirim file audio MP3..._`
      });
    }

    const fullAudioUrl = `http://localhost:${process.env.PORT || 3000}${data.downloadUrl}`;
    const audioBuf = await getBuffer(fullAudioUrl);
    await sock.sendMessage(targetJid, {
      audio: audioBuf,
      mimetype: 'audio/mp4',
      fileName: data.fileName || `${data.title}.mp3`
    });

    console.log(`[Apple Music] Sukses mengirim lagu: ${data.title}`);
  } catch (err) {
    console.error('[Apple Music Error]:', err.message);
    await sock.sendMessage(targetJid, {
      text: `❌ *Gagal mendownload Apple Music:*\n${err.message}`
    });
  }
}

/**
 * Handler Twitter / X
 */
async function handleTwitter(sock, targetJid, url) {
  console.log(`[Twitter/X] Mengunduh: ${url}`);
  try {
    const data = await downloadTwitter(url);

    // KASUS 1: Video
    if (data.type === 'video' && data.videoUrl) {
      await sock.sendMessage(targetJid, {
        video: { url: data.videoUrl },
        caption: `🐦 *Twitter/X Video*\n👤 *Author:* ${data.author}\n📝 *Tweet:* ${data.title ? data.title.slice(0, 150) : '-'}`
      });
      console.log('[Twitter/X] Sukses mengirim video');
      return;
    }

    // KASUS 2: Photos (Album)
    if (data.type === 'images' && Array.isArray(data.images) && data.images.length > 0) {
      const total = data.images.length;
      if (total === 1) {
        await sock.sendMessage(targetJid, {
          image: { url: data.images[0] },
          caption: `🐦 *Twitter/X Photo*\n👤 *Author:* ${data.author}\n📝 *Tweet:* ${data.title ? data.title.slice(0, 150) : '-'}`
        });
      } else {
        const imageBuffers = await Promise.all(
          data.images.map(imgUrl => getBuffer(imgUrl))
        );

        await Promise.all(
          imageBuffers.map((buf, idx) =>
            sock.sendMessage(targetJid, {
              image: buf,
              caption: idx === 0 ? `🐦 *Twitter/X Album (${total} Foto)*\n👤 *Author:* ${data.author}\n📝 *Tweet:* ${data.title ? data.title.slice(0, 150) : '-'}` : undefined
            })
          )
        );
      }
      console.log(`[Twitter/X] Sukses mengirim ${total} foto`);
      return;
    }

    throw new Error('Media Twitter tidak dikenali.');
  } catch (err) {
    console.error('[Twitter Error]:', err.message);
    await sock.sendMessage(targetJid, {
      text: `❌ *Gagal mendownload Twitter/X:*\n${err.message}`
    });
  }
}

/**
 * Handler Pinterest
 */
async function handlePinterest(sock, targetJid, url) {
  console.log(`[Pinterest] Mengunduh: ${url}`);
  try {
    const data = await downloadPinterest(url);

    if (data.type === 'video' && data.videoUrl) {
      await sock.sendMessage(targetJid, {
        video: { url: data.videoUrl },
        caption: `📌 *Pinterest Video*\n📝 *Title:* ${data.title}`
      });
    } else if (data.imageUrl) {
      await sock.sendMessage(targetJid, {
        image: { url: data.imageUrl },
        caption: `📌 *Pinterest HD Photo*\n📝 *Title:* ${data.title}`
      });
    }

    console.log('[Pinterest] Sukses mengirim media');
  } catch (err) {
    console.error('[Pinterest Error]:', err.message);
    await sock.sendMessage(targetJid, {
      text: `❌ *Gagal mendownload Pinterest:*\n${err.message}`
    });
  }
}

/**
 * Handler Facebook
 */
async function handleFacebook(sock, targetJid, url) {
  console.log(`[Facebook] Mengunduh: ${url}`);
  try {
    const data = await downloadFacebook(url);

    await sock.sendMessage(targetJid, {
      video: { url: data.videoUrl },
      caption: `🎬 *Facebook Video / Reels*\n📝 *Title:* ${data.title}`
    });

    console.log('[Facebook] Sukses mengirim video');
  } catch (err) {
    console.error('[Facebook Error]:', err.message);
    await sock.sendMessage(targetJid, {
      text: `❌ *Gagal mendownload Facebook:*\n${err.message}`
    });
  }
}

/**
 * Handler TikTok
 */
async function handleTikTok(sock, targetJid, url, isAudioOnly = false) {
  console.log(`[TikTok] Mengunduh: ${url} (audioOnly: ${isAudioOnly})`);
  try {
    const data = await downloadTikTok(url);

    // Jika user minta audio saja dan audio tersedia
    if (isAudioOnly && data.musicUrl) {
      await sock.sendMessage(targetJid, {
        audio: { url: data.musicUrl },
        mimetype: 'audio/mp4',
        fileName: `${data.title || 'tiktok_audio'}.mp3`,
        caption: `🎵 *TikTok Audio Only*\n👤 *Creator:* ${data.author}\n📝 *Title:* ${data.title || '-'}`
      });
      return;
    }

    // KASUS 1: Postingan Foto Slide (Bisa 1 atau banyak foto)
    if (data.type === 'images' && Array.isArray(data.images) && data.images.length > 0) {
      const total = data.images.length;

      if (total === 1) {
        await sock.sendMessage(targetJid, {
          image: { url: data.images[0] },
          caption: `📸 *TikTok Photo*\n👤 *Creator:* ${data.author}\n📝 *Caption:* ${data.title || '-'}`
        });
      } else {
        // Unduh semua buffer foto secara bersamaan
        const imageBuffers = await Promise.all(
          data.images.map(imgUrl => getBuffer(imgUrl))
        );

        // Kirim semua foto secara serentak (Promise.all)
        await Promise.all(
          imageBuffers.map((buf, idx) =>
            sock.sendMessage(targetJid, {
              image: buf,
              caption: idx === 0 ? `📸 *TikTok Slide (${total} Foto)*\n👤 *Creator:* ${data.author}\n📝 *Caption:* ${data.title || '-'}` : undefined
            })
          )
        );
      }

      // Kirim audio/musik jika ada
      if (data.musicUrl) {
        await delay(500);
        await sock.sendMessage(targetJid, {
          audio: { url: data.musicUrl },
          mimetype: 'audio/mp4',
          fileName: 'tiktok_audio.mp3'
        });
      }

      console.log(`[TikTok] Sukses mengirim ${total} foto sekaligus sebagai Album`);
      return;
    }

    // KASUS 2: Video No-Watermark
    if (data.type === 'video' && data.videoUrl) {
      await sock.sendMessage(targetJid, {
        video: { url: data.videoUrl },
        caption: `🎬 *TikTok Video (No Watermark)*\n👤 *Creator:* ${data.author}\n📝 *Title:* ${data.title || '-'}`
      });
      console.log('[TikTok] Sukses mengirim video');
      return;
    }

    throw new Error('Format media TikTok tidak dikenali.');
  } catch (err) {
    console.error('[TikTok Error]:', err.message);
    await sock.sendMessage(targetJid, {
      text: `❌ *Gagal mendownload TikTok:*\n${err.message}`
    });
  }
}

/**
 * Handler Instagram
 */
async function handleInstagram(sock, targetJid, url) {
  console.log(`[Instagram] Mengunduh: ${url}`);
  try {
    const data = await downloadInstagram(url);

    if (!data.items || data.items.length === 0) {
      throw new Error('Tidak ada media yang ditemukan pada link Instagram ini.');
    }

    const total = data.items.length;

    // 1 Media
    if (total === 1) {
      const item = data.items[0];
      if (item.type === 'video') {
        await sock.sendMessage(targetJid, {
          video: { url: item.url },
          caption: `🎬 *Instagram Video / Reels*\n📝 *Caption:* ${data.caption ? data.caption.slice(0, 200) : '-'}`
        });
      } else {
        await sock.sendMessage(targetJid, {
          image: { url: item.url },
          caption: `📸 *Instagram Photo*\n📝 *Caption:* ${data.caption ? data.caption.slice(0, 200) : '-'}`
        });
      }
      console.log('[Instagram] Sukses mengirim 1 media');
      return;
    }

    // Multiple Media (Carousel)
    const imageUrls = data.items.filter(i => i.type === 'image').map(i => i.url);
    const videoItems = data.items.filter(i => i.type === 'video');

    if (imageUrls.length > 0) {
      const imageBuffers = await Promise.all(
        imageUrls.map(imgUrl => getBuffer(imgUrl))
      );

      await Promise.all(
        imageBuffers.map((buf, idx) =>
          sock.sendMessage(targetJid, {
            image: buf,
            caption: idx === 0 ? `📸 *Instagram Album (${imageUrls.length} Foto)*\n📝 *Caption:* ${data.caption ? data.caption.slice(0, 150) : '-'}` : undefined
          })
        )
      );
    }

    for (const v of videoItems) {
      await sock.sendMessage(targetJid, {
        video: { url: v.url },
        caption: '🎬 Video Carousel'
      });
    }

    console.log(`[Instagram] Sukses mengirim ${total} media carousel sekaligus sebagai Album`);
  } catch (err) {
    console.error('[Instagram Error]:', err.message);
    await sock.sendMessage(targetJid, {
      text: `❌ *Gagal mendownload Instagram:*\n${err.message}`
    });
  }
}

/**
 * Helper to convert readable stream to Buffer with size guard (e.g. max 70MB for WhatsApp)
 */
async function streamToBuffer(stream, maxBytes = 70 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    stream.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        stream.destroy();
        reject(new Error('Ukuran video melebihi batas WhatsApp (70MB). Gunakan Web untuk mengunduh video panjang: https://whats-tok.vercel.app'));
      } else {
        chunks.push(chunk);
      }
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Handler YouTube
 */
async function handleYouTube(sock, targetJid, url, isAudioOnly = false) {
  console.log(`[YouTube] Mengunduh: ${url} (audioOnly: ${isAudioOnly})`);
  try {
    const data = await downloadYouTube(url);

    // Jika minta audio saja
    if (isAudioOnly) {
      if (data.getAudioStream) {
        const audioBuf = await streamToBuffer(data.getAudioStream());
        await sock.sendMessage(targetJid, {
          audio: audioBuf,
          mimetype: 'audio/mp4',
          fileName: `${data.title}.mp3`
        });
      } else if (data.videoUrl) {
        await sock.sendMessage(targetJid, {
          audio: { url: data.videoUrl },
          mimetype: 'audio/mp4',
          fileName: `${data.title}.mp3`
        });
      }
      console.log('[YouTube] Sukses mengirim audio YouTube');
      return;
    }

    // Video stream buffer
    if (data.getStream) {
      const videoBuf = await streamToBuffer(data.getStream());
      await sock.sendMessage(targetJid, {
        video: videoBuf,
        caption: `▶️ *YouTube Video*\n📌 *Judul:* ${data.title}\n⏱️ *Durasi:* ${data.duration || '-'}\n👤 *Channel:* ${data.author || '-'}`
      });
    } else if (data.videoUrl) {
      await sock.sendMessage(targetJid, {
        video: { url: data.videoUrl },
        caption: `▶️ *YouTube Video*\n📌 *Judul:* ${data.title}\n⏱️ *Durasi:* ${data.duration || '-'}\n👤 *Channel:* ${data.author || '-'}`
      });
    }

    console.log('[YouTube] Sukses mengirim video');
  } catch (err) {
    console.error('[YouTube Error]:', err.message);
    await sock.sendMessage(targetJid, {
      text: `❌ *Gagal mendownload YouTube:*\n${err.message}`
    });
  }
}
