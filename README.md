# Whats-Tok: Dual-Platform Media Downloader 🚀

Platform pengunduh media pintar serbaguna yang hadir dalam **2 platform sekaligus**:
1. 📱 **Native WhatsApp Bot**: Langsung di chat WhatsApp pribadi (*Message Yourself*), otomatis mendeteksi link dan mengirim media/album serentak ke galeri.
2. 🌐 **Professional Web Application**: Web modern siap deploy (desktop & mobile friendly) dengan antarmuka Glassmorphism gelap, tombol paste 1-klik, dan pemutar media bawaan.

---

## ✨ Fitur Utama & Platform yang Didukung

### 1. 🎵 Ekstraktor Musik & Audio (Fitur 1)
- 🎧 **Spotify**: Unduh track musik Spotify lengkap dengan cover album, judul artis, dan kualitas MP3 jernih.
- 🔊 **Mode Audio Only**: Kirim link TikTok, Reels, atau YouTube dengan kata `mp3`, `audio`, atau `lagu` di chat, bot otomatis hanya mengirimkan audio lagunya saja!

### 2. 🌐 Media Downloader Lengkap (Fitur 3)
- 🎬 **TikTok**:
  - Video HD tanpa watermark.
  - Slide Foto (Carousel) dikirim serentak sebagai Album Grid langsung ke chat.
  - Audio/soundtrack postingan.
- 📸 **Instagram**:
  - Reels & Video HD.
  - Single Photo resolusi penuh.
  - Multi-photo Carousel/Album dikirim serentak tanpa spam balon chat.
- 🐦 **Twitter / X**: Video HD, GIF, dan galeri foto tweet.
- 📌 **Pinterest**: Foto kualitas original (Original HD) & Video ide Pin.
- 👥 **Facebook**: Video publik dan Facebook Reels kualitas tinggi.
- ▶️ **YouTube**: Video dan YouTube Shorts MP4.

---

## 📁 Struktur Proyek

```text
whats-tok/
├── public/                 # Frontend Web Application (HTML, Tailwind CSS, Lucide)
│   └── index.html
├── src/
│   ├── index.js            # Entry point bot WhatsApp & Web Server
│   ├── server.js           # Express REST API & Web Server
│   ├── handler.js          # WhatsApp Message Handler & Router
│   ├── config.js           # Konfigurasi bot (onlySelf, privateOnly)
│   ├── lib/
│   │   ├── downloader.js   # Unified Router Downloader
│   │   ├── spotify.js      # Engine Spotify MP3
│   │   ├── tiktok.js       # Engine TikTok Video & Slide
│   │   ├── instagram.js    # Engine Instagram Reels & Carousel
│   │   ├── twitter.js      # Engine Twitter/X Media
│   │   ├── pinterest.js    # Engine Pinterest Photo/Video
│   │   ├── facebook.js     # Engine Facebook Video
│   │   └── youtube.js      # Engine YouTube Video/Audio
│   └── utils/
│       └── helpers.js      # Helper buffer, delay, extractor
├── session/                # Sesi login WhatsApp (Baileys Multi-Device)
├── Dockerfile              # Docker container untuk Cloud Deployment
├── package.json
└── README.md
```

---

## 🚀 Cara Menjalankan

### Opsi 1: Menjalankan Keduanya (WhatsApp Bot + Web Platform)
```bash
npm start
```
- WhatsApp Bot akan aktif dan terhubung ke nomor kamu.
- Web Platform akan berjalan di `http://localhost:3000`.

### Opsi 2: Menjalankan Web Platform Saja
Jika ingin mendeploy atau hanya menggunakan versi websitenya:
```bash
npm run web
```
Buka browser di `http://localhost:3000`.

### Opsi 3: Menjalankan di Background (PM2)
Agar tetap aktif meskipun jendela terminal ditutup:
```bash
npm run pm2:start
npm run pm2:logs     # Melihat aktivitas bot
npm run pm2:stop     # Mematikan
```

---

## 🌐 Panduan Deploy Web ke Cloud (Railway / Render / VPS)

Proyek ini sudah dilengkapi dengan `Dockerfile` dan konfigurasi port otomatis (`process.env.PORT`):

1. **Deploy ke Railway**:
   - Buka [railway.app](https://railway.app).
   - Buat New Project $\rightarrow$ Pilih **Deploy from GitHub repo** $\rightarrow$ pilih `muhmdathalla/whats-tok-`.
   - Railway otomatis mendeteksi `Dockerfile` dan membuatkan URL publik (misal: `https://whats-tok.up.railway.app`).

2. **Deploy ke Render**:
   - Buka [render.com](https://render.com) $\rightarrow$ New **Web Service**.
   - Hubungkan repo `muhmdathalla/whats-tok-`.
   - Build Command: `npm install`
   - Start Command: `npm run web`

---

## 👨‍💻 Author
Dibuat dengan ❤️ oleh **[Muhammad Athalla](https://github.com/muhmdathalla)**.
Repositori: [muhmdathalla/whats-tok-](https://github.com/muhmdathalla/whats-tok-)
