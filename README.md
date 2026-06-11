# R2BM — Cloudflare R2 File Manager

Manage Cloudflare R2 buckets directly from your browser. Upload images (auto-compressed to ≤128 KB), videos, and PDFs. Generate public URLs with QR codes, share embed codes, and enable r2.dev public domains — all with encrypted credential storage.

Built by [Ketut Dana](https://github.com/dnysaz).

## Features

- **Multi-file support** — Images (auto-compress ≤128 KB), videos (≤5 MB), PDFs (≤1 MB)
- **Bucket management** — Create, list, empty, and delete R2 buckets
- **Public URLs** — Auto-enable r2.dev managed domains via Cloudflare API
- **Share modal** — Copy link, copy embed HTML (image/video/PDF), QR code for mobile scanning
- **Image compression** — Toggle on/off before upload; iterative quality reduction + resize to hit 128 KB target
- **Encrypted credentials** — R2 and Cloudflare API keys encrypted with AES-256-GCM, never stored in plaintext
- **Responsive** — Desktop sidebar layout, mobile bottom upload button with drawer
- **Lightbox** — Click image for fullscreen preview
- **Dark code block** — Embed HTML displayed in a terminal-style pre block

## Tech Stack

- **Framework** — Next.js 16 (App Router, Turbopack)
- **Database & Auth** — Supabase (Postgres, Auth with email/password, RLS)
- **Storage** — Cloudflare R2 (S3-compatible API via `@aws-sdk/client-s3`)
- **Image processing** — Sharp (server-side compression)
- **QR codes** — `api.qrserver.com` (client-side rendering)
- **Styling** — Tailwind CSS v4, custom sage palette
- **Encryption** — AES-256-GCM (`crypto`)

## Prerequisites

- Node.js ≥ 18
- A Supabase project (self-hosted or Cloud)
- A Cloudflare R2 account with bucket(s)
- Cloudflare Global API Key (for auto-enabling r2.dev domains)

## Setup

```bash
git clone https://github.com/dnysaz/r2bm.git
cd r2bm
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (for auto-confirm registration) |
| `ENCRYPTION_KEY` | 64-character hex key for AES-256-GCM |

### Database

Run `supabase.sql` in your Supabase SQL editor to create the `r2_credentials` table with RLS policies.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. **Register / Sign In** — Email + password. No email confirmation needed (auto-confirmed via Admin API).
2. **Add R2 Credentials** — Go to Settings → enter your R2 Account ID, Access Key, Secret Key, and (optional) Cloudflare API credentials.
3. **Create a Bucket** — Click **+ Create** in the navbar. Check "Public bucket" to auto-enable r2.dev domain.
4. **Upload Files** — Drag & drop or click to upload. Uncheck "Compress image" to skip compression.
5. **Share** — Click the Share button on any file → copy link, copy embed HTML, or scan QR code.

## Security

- R2 credentials are encrypted (AES-256-GCM) before storage.
- The encryption key is never sent to the client.
- All file transfers go directly between your browser and Cloudflare R2.
- Supabase RLS ensures users can only access their own credentials.
- Registration uses the Supabase Admin API with `email_confirm: true` — no confirmation email needed.

## License

MIT © Ketut Dana
