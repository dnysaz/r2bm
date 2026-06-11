-- R2 Bucket Manager by Only4.fun — Supabase Schema
-- Jalankan query ini di Supabase SQL Editor

-- =====================================================
-- Tabel: r2_credentials (ENCRYPTED)
-- Menyimpan kredensial R2 per user dalam bentuk terenkripsi
-- =====================================================

create table if not exists public.r2_credentials (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  encrypted_data text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id)
);

-- Enable Row Level Security
alter table public.r2_credentials enable row level security;

-- Policy: user hanya bisa SELECT data miliknya sendiri
create policy "Users can view own credentials"
  on public.r2_credentials for select
  using (auth.uid() = user_id);

-- Policy: user hanya bisa INSERT data miliknya sendiri
create policy "Users can insert own credentials"
  on public.r2_credentials for insert
  with check (auth.uid() = user_id);

-- Policy: user hanya bisa UPDATE data miliknya sendiri
create policy "Users can update own credentials"
  on public.r2_credentials for update
  using (auth.uid() = user_id);

-- Policy: user hanya bisa DELETE data miliknya sendiri
create policy "Users can delete own credentials"
  on public.r2_credentials for delete
  using (auth.uid() = user_id);

-- Trigger: auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_r2_credentials_updated_at on public.r2_credentials;
create trigger update_r2_credentials_updated_at
  before update on public.r2_credentials
  for each row execute procedure update_updated_at();

-- =====================================================
-- Hapus tabel lama (r2_settings) jika ada
-- =====================================================

drop table if exists public.r2_settings;

-- =====================================================
-- NOTE:
-- 1. Buat user via halaman Register atau Supabase Auth UI
-- 2. Setelah login, user input R2 credentials di Settings
-- 3. Credentials akan dienkripsi AES-256-GCM dan disimpan di sini
-- 4. ENCRYPTION_KEY harus di-set di .env.local (32 bytes hex)
-- =====================================================
