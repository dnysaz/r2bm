# R2 File Manager

Next.js app untuk mengelola file di Cloudflare R2 dengan autentikasi Supabase.

## Setup

1. Salin `.env.local.example` ke `.env.local`
2. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` dari project Supabase Anda
3. Buat user di Supabase Auth (hanya login, tidak ada registrasi)
4. Jalankan `npm install && npm run dev`

## Konfigurasi

Buka aplikasi dan masuk ke halaman Settings untuk mengisi:
- Account ID
- Access Key ID
- Secret Access Key  
- Endpoint (https://accountid.r2.cloudflarestorage.com)
- Public URL (opsional, untuk custom domain)

## Fitur

- CRUD Bucket
- Upload/Download/Delete file
- Auto-compress gambar (JPEG/WebP/GIF dengan quality 85%)
- Batas ukuran file (default 10MB, configurable via env)
- Copy link untuk digunakan di website