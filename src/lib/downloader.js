import { downloadTikTok } from './tiktok.js';
import { downloadInstagram } from './instagram.js';
import { downloadYouTube } from './youtube.js';
import { downloadSpotify } from './spotify.js';
import { downloadTwitter } from './twitter.js';
import { downloadPinterest } from './pinterest.js';
import { downloadFacebook } from './facebook.js';

export const PATTERNS = {
  TIKTOK: /(?:https?:\/\/)?(?:www\.|vm\.|vt\.|t\.)?tiktok\.com\/[^\s]+/i,
  INSTAGRAM: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|reels|stories|tv|share)\/[^\s]+/i,
  YOUTUBE: /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s]+/i,
  SPOTIFY: /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist)\/[^\s]+/i,
  TWITTER: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/(?:#!\/)?[a-zA-Z0-9_]+\/status(?:es)?\/[0-9]+/i,
  PINTEREST: /(?:https?:\/\/)?(?:www\.)?(?:pinterest\.com\/pin|pin\.it)\/[^\s]+/i,
  FACEBOOK: /(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch)\/[^\s]+/i,
};

/**
 * Detect platform from URL
 */
export function detectPlatform(url) {
  if (PATTERNS.TIKTOK.test(url)) return 'tiktok';
  if (PATTERNS.INSTAGRAM.test(url)) return 'instagram';
  if (PATTERNS.YOUTUBE.test(url)) return 'youtube';
  if (PATTERNS.SPOTIFY.test(url)) return 'spotify';
  if (PATTERNS.TWITTER.test(url)) return 'twitter';
  if (PATTERNS.PINTEREST.test(url)) return 'pinterest';
  if (PATTERNS.FACEBOOK.test(url)) return 'facebook';
  return null;
}

/**
 * Unified downloader function for WhatsApp Bot & Web API
 */
export async function downloadMedia(url, options = {}) {
  const platform = detectPlatform(url);

  switch (platform) {
    case 'tiktok':
      return { platform: 'tiktok', ...(await downloadTikTok(url)) };
    case 'instagram':
      return { platform: 'instagram', ...(await downloadInstagram(url)) };
    case 'youtube':
      return { platform: 'youtube', ...(await downloadYouTube(url)) };
    case 'spotify':
      return { platform: 'spotify', ...(await downloadSpotify(url)) };
    case 'twitter':
      return { platform: 'twitter', ...(await downloadTwitter(url)) };
    case 'pinterest':
      return { platform: 'pinterest', ...(await downloadPinterest(url)) };
    case 'facebook':
      return { platform: 'facebook', ...(await downloadFacebook(url)) };
    default:
      throw new Error('Platform tidak didukung. Masukkan link TikTok, Instagram, YouTube, Spotify, X/Twitter, Pinterest, atau Facebook.');
  }
}
