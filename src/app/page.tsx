'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ──────────────────────────────────────────────────────────

interface Bucket {
  Name: string
  CreationDate: string
}

interface FileItem {
  Key: string
  Size: number
  LastModified: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

interface R2Credentials {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  publicUrl: string
  cloudflareApiKey: string
  cloudflareApiEmail: string
}

// ─── Helpers ─────────────────────────────────────────────────────────

function emptyCreds(): R2Credentials {
  return { accountId: '', accessKeyId: '', secretAccessKey: '', endpoint: '', publicUrl: '', cloudflareApiKey: '', cloudflareApiEmail: '' }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ─── Toast System ────────────────────────────────────────────────────

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

let toastId = 0

// ─── Floating Shapes Background ──────────────────────────────────────

function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="animate-float absolute -left-10 -top-10 h-72 w-72 rounded-full bg-sage-100/80 blur-3xl" />
      <div className="animate-float absolute -bottom-20 -right-10 h-96 w-96 rounded-full bg-sage-100/60 blur-3xl" style={{ animationDelay: '2s' }} />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxNzE3MTciIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-100" />
    </div>
  )
}

// ─── Toast Component ─────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'animate-slide-in-right flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-medium shadow-xl backdrop-blur-xl',
            toast.type === 'success' && 'bg-emerald-600/90 text-white',
            toast.type === 'error' && 'bg-red-600/90 text-white',
            toast.type === 'info' && 'bg-gray-800/90 text-white'
          )}
        >
          <span className="h-5 w-5 shrink-0">
            {toast.type === 'success' ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : toast.type === 'error' ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            )}
          </span>
          <span>{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Confirm Modal ───────────────────────────────────────────────────

function ConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="animate-scale-in relative mx-4 w-full max-w-sm rounded-2xl border border-sage-300 bg-white p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 mx-auto">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="mt-4 text-center text-lg font-bold text-sage-900">Confirm Delete</h3>
        <p className="mt-2 text-center text-sm text-sage-600">{message}</p>
        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button onClick={onConfirm} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-600/20 active:scale-[0.98]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Bucket Modal ──────────────────────────────────────────────

function DeleteBucketModal({
  bucket,
  onConfirm,
  onCancel,
}: {
  bucket: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const match = typed === bucket

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="animate-scale-in relative mx-4 w-full max-w-sm rounded-2xl border border-sage-300 bg-white p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 mx-auto">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="mt-4 text-center text-lg font-bold text-sage-900">Delete Bucket</h3>
        <p className="mt-2 text-center text-sm text-sage-600">
          This will permanently delete the bucket <strong>{bucket}</strong> and all files inside it.
        </p>
        <div className="mt-4">
          <label className="block text-sm font-medium text-sage-900">
            Type <span className="font-mono text-red-600">{bucket}</span> to confirm:
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={bucket}
            className="input-modern mt-1.5 w-full"
            onKeyDown={(e) => e.key === 'Enter' && match && onConfirm()}
          />
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!match}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-150 focus:outline-none focus:ring-1 active:scale-[0.98]',
              match
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600/20'
                : 'bg-red-300 cursor-not-allowed'
            )}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete Bucket
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Login / Register Page ───────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [legalModal, setLegalModal] = useState<'terms' | 'about' | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Invalid email or password' : error.message)
      setLoading(false)
    } else {
      onLogin()
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Registration failed')
      setLoading(false)
    } else {
      setRegistered(true)
      setLoading(false)
    }
  }

  const handleSubmit = mode === 'login' ? handleLogin : handleRegister

  return (
    <div className="flex min-h-screen">
      {/* Left — Branding */}
      <div className="hidden flex-1 flex-col items-center justify-center bg-white p-12 lg:flex">
        <div className="animate-fade-in-up max-w-md text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-sage-100">
            <svg className="h-10 w-10 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9.75v-4.5m0 0a2.25 2.25 0 00-2.25-2.25h-15a2.25 2.25 0 00-2.25 2.25v4.5m19.5 0v4.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25v-4.5m19.5 0h-19.5" />
            </svg>
          </div>
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-sage-900">
            R2BM
          </h1>
          <p className="mt-1 text-sm font-medium text-sage-500">
            R2 Bucket Manager
          </p>
          <p className="mt-6 text-base leading-relaxed text-sage-600">
            Upload, organize, and share your files in seconds. Lightning-fast Cloudflare R2 storage made simple.
          </p>
          <div className="mt-8 flex justify-center gap-6 text-sm">
            <button onClick={() => setLegalModal('terms')} className="text-sage-400 underline underline-offset-2 hover:text-sage-700 transition-colors">
              Terms & Conditions
            </button>
            <button onClick={() => setLegalModal('about')} className="text-sage-400 underline underline-offset-2 hover:text-sage-700 transition-colors">
              About
            </button>
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="animate-scale-in w-full max-w-sm">
          <div className="mb-6 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-sage-900">R2BM</h1>
            <p className="mt-0.5 text-sm font-medium text-sage-500">by only4.fun</p>
          </div>

          <div className="rounded-2xl border border-sage-300 bg-white px-8 py-10 shadow-sm">
            {/* Mode toggle */}
            {registered ? null : (
              <div className="mb-6 flex rounded-lg border border-sage-300 p-0.5">
                <button
                  onClick={() => { setMode('login'); setError('') }}
                  className={cn(
                    'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all duration-150',
                    mode === 'login' ? 'bg-sage-900 text-white shadow-sm' : 'text-sage-600 hover:text-sage-900'
                  )}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMode('register'); setError('') }}
                  className={cn(
                    'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all duration-150',
                    mode === 'register' ? 'bg-sage-900 text-white shadow-sm' : 'text-sage-600 hover:text-sage-900'
                  )}
                >
                  Register
                </button>
              </div>
            )}

            {registered ? (
              <div className="animate-fade-in-up text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                  <svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-sage-900">Account created</h2>
                <p className="mt-2 text-sm text-sage-600">
                  You can now sign in with your credentials.
                </p>
                <button
                  onClick={() => { setMode('login'); setRegistered(false); setError('') }}
                  className="btn-primary mt-6 w-full"
                >
                  Sign in
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-sage-900">
                  {mode === 'login' ? 'Welcome back' : 'Create account'}
                </h2>
                <p className="mt-1 text-sm text-sage-500">
                  {mode === 'login' ? 'Sign in to manage your buckets' : 'Register to start managing R2 buckets'}
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <label htmlFor="login-email" className="block text-sm font-medium text-sage-900">
                      Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="input-modern mt-1.5 w-full"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-sm font-medium text-sage-900">
                      Password
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        className="input-modern w-full pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600 transition-colors"
                      >
                        {showPassword ? (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {mode === 'register' && (
                    <div>
                      <label htmlFor="login-confirm" className="block text-sm font-medium text-sage-900">
                        Confirm Password
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          id="login-confirm"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                          className="input-modern w-full pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600 transition-colors"
                        >
                          {showConfirmPassword ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="animate-fade-in-up rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600 ring-1 ring-red-100">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full"
                  >
                    {loading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                      </>
                    ) : (
                      mode === 'login' ? 'Sign in' : 'Create account'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
          {/* Mobile legal links */}
          <div className="mt-6 flex justify-center gap-5 text-xs lg:hidden">
            <button onClick={() => setLegalModal('terms')} className="text-sage-400 underline underline-offset-2 hover:text-sage-700 transition-colors">
              Terms & Conditions
            </button>
            <button onClick={() => setLegalModal('about')} className="text-sage-400 underline underline-offset-2 hover:text-sage-700 transition-colors">
              About
            </button>
          </div>
        </div>
      </div>

      {/* Legal modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setLegalModal(null)} />
          <div className="animate-scale-in mx-4 w-full max-w-2xl rounded-2xl border border-sage-300 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-sage-200 px-6 py-4">
              <h3 className="text-lg font-bold text-sage-900">
                {legalModal === 'terms' ? 'Terms & Conditions' : 'About'}
              </h3>
              <button onClick={() => setLegalModal(null)} className="rounded-xl p-2 text-sage-400 hover:bg-sage-50 hover:text-sage-800 transition-all">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 space-y-4 text-sm text-sage-600 leading-relaxed">
              {legalModal === 'terms' ? (
                <>
                  <p>By using R2 Bucket Manager, you agree to the following terms and conditions.</p>
                  <h4 className="font-semibold text-sage-900">Data Storage & Security</h4>
                  <p>All Cloudflare R2 API credentials (Account ID, Access Key ID, Secret Access Key, Cloudflare API Key) are encrypted using AES-256-GCM before being stored in our database. The encryption key is never exposed to the client and is managed server-side.</p>
                  <h4 className="font-semibold text-sage-900">File Storage</h4>
                  <p>Files uploaded to R2 buckets are stored directly in your Cloudflare R2 account. We do not store copies of your files on our servers. All file transfers occur directly between your browser and Cloudflare R2 infrastructure.</p>
                  <h4 className="font-semibold text-sage-900">Data Privacy</h4>
                  <p>We only store the minimum information required to provide the service: authentication credentials and encrypted R2 API keys. We do not track, log, or share your personal data with third parties.</p>
                  <h4 className="font-semibold text-sage-900">User Responsibility</h4>
                  <p>You are responsible for maintaining the confidentiality of your Cloudflare R2 credentials and for all activities that occur under your account. We recommend using restricted API tokens with the minimum required permissions.</p>
                  <h4 className="font-semibold text-sage-900">Service Availability</h4>
                  <p>This service is provided as-is without warranty of any kind. We are not responsible for any data loss or service interruptions that may occur.</p>
                </>
              ) : (
                <>
                  <p><strong>R2 Bucket Manager</strong> is an open-source web application for managing Cloudflare R2 storage buckets.</p>
                  <p>Built with Next.js, Supabase, and the AWS S3 SDK. Features include file upload with compression, bucket management, public URL generation via Cloudflare API, and encrypted credential storage.</p>
                  <p>Created by <strong>Ketut Dana</strong>.</p>
                  <p>You can download, modify, and improve this project:</p>
                  <div className="rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 font-mono text-sm">
                    <a href="https://github.com/dnysaz/r2bm.git" target="_blank" rel="noopener noreferrer" className="text-sage-700 hover:text-sage-900 underline underline-offset-2">
                      https://github.com/dnysaz/r2bm.git
                    </a>
                  </div>
                  <p className="pt-2 text-xs text-sage-400">Released under the MIT License — free to use, modify, and distribute.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Settings Panel ──────────────────────────────────────────────────

function SettingsPanel({
  creds,
  onSave,
  onClose,
  supabase,
}: {
  creds: R2Credentials
  onSave: (c: R2Credentials) => void
  onClose: () => void
  supabase: typeof import('@/lib/supabase').supabase
}) {
  const [local, setLocal] = useState<R2Credentials>(creds)
  const [showSecret, setShowSecret] = useState(false)
  const [showCfKey, setShowCfKey] = useState(false)
  const [tab, setTab] = useState<'cloudflare' | 'profile'>('cloudflare')
  const [displayName, setDisplayName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConPw, setShowConPw] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSuccess, setNameSuccess] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data?.user?.user_metadata || {}
      setDisplayName(meta.display_name || meta.name || '')
      setUserEmail(data?.user?.email || '')
    })
  }, [supabase])

  const handleNameSave = async () => {
    setNameError(''); setNameSuccess('')
    if (!displayName) return
    setSavingName(true)
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } })
    setSavingName(false)
    if (error) setNameError(error.message)
    else setNameSuccess('Name updated')
  }

  const handlePasswordSave = async () => {
    setPwError(''); setPwSuccess('')
    if (newPassword && newPassword.length < 6) { setPwError('Password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPw(false)
    if (error) setPwError(error.message)
    else { setPwSuccess('Password updated'); setNewPassword(''); setConfirmPassword('') }
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-slide-in-right relative ml-auto flex h-full w-full max-w-xl flex-col border-l border-sage-300 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-sage-300 px-6 py-5">
          <h2 className="text-lg font-bold" style={{ color: '#171717' }}>Settings</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-sage-400 hover:bg-sage-50 hover:text-sage-800 transition-all">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-sage-200 px-6">
          <button
            onClick={() => setTab('cloudflare')}
            className={cn(
              'px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px',
              tab === 'cloudflare' ? 'border-sage-900 text-sage-900' : 'border-transparent text-sage-500 hover:text-sage-700'
            )}
          >
            Cloudflare
          </button>
          <button
            onClick={() => setTab('profile')}
            className={cn(
              'px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px',
              tab === 'profile' ? 'border-sage-900 text-sage-900' : 'border-transparent text-sage-500 hover:text-sage-700'
            )}
          >
            Profile
          </button>
        </div>

        {tab === 'cloudflare' && (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <p className="text-sm text-sage-500">
              Your R2 credentials are encrypted with AES-256-GCM and stored securely in your account.
            </p>

            <div>
              <label className="block text-sm font-medium" style={{ color: '#171717' }}>Account ID</label>
              <input value={local.accountId} onChange={(e) => setLocal({ ...local, accountId: e.target.value })} placeholder="Account ID" className="input-modern mt-1.5" />
            </div>
            <div>
              <label className="block text-sm font-medium" style={{ color: '#171717' }}>Access Key ID</label>
              <input value={local.accessKeyId} onChange={(e) => setLocal({ ...local, accessKeyId: e.target.value })} placeholder="Access Key ID" className="input-modern mt-1.5" />
            </div>
            <div>
              <label className="block text-sm font-medium" style={{ color: '#171717' }}>Secret Access Key</label>
              <div className="relative mt-1.5">
                <input type={showSecret ? 'text' : 'password'} autoComplete="off" value={local.secretAccessKey} onChange={(e) => setLocal({ ...local, secretAccessKey: e.target.value })} placeholder="Secret Access Key" className="input-modern w-full pr-10" />
                <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600">
                  {showSecret ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium" style={{ color: '#171717' }}>Endpoint</label>
              <input value={local.endpoint} onChange={(e) => setLocal({ ...local, endpoint: e.target.value })} placeholder="https://accountid.r2.cloudflarestorage.com" className="input-modern mt-1.5" />
            </div>
            <div>
              <label className="block text-sm font-medium" style={{ color: '#171717' }}>Public URL</label>
              <input value={local.publicUrl} onChange={(e) => setLocal({ ...local, publicUrl: e.target.value })} placeholder="https://custom.domain (optional)" className="input-modern mt-1.5" />
            </div>

            <div className="border-t border-sage-200 pt-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-sage-500 mb-3">Cloudflare API</h3>
              <p className="text-xs text-sage-500 mb-4">
                Required to auto-enable r2.dev public URL when creating public buckets.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium" style={{ color: '#171717' }}>Global API Key</label>
                  <div className="relative mt-1.5">
                    <input type={showCfKey ? 'text' : 'password'} autoComplete="off" value={local.cloudflareApiKey} onChange={(e) => setLocal({ ...local, cloudflareApiKey: e.target.value })} placeholder="Cloudflare Global API Key" className="input-modern w-full pr-10" />
                    <button type="button" onClick={() => setShowCfKey(!showCfKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600">
                      {showCfKey ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium" style={{ color: '#171717' }}>Account Email</label>
                  <input value={local.cloudflareApiEmail} onChange={(e) => setLocal({ ...local, cloudflareApiEmail: e.target.value })} placeholder="email@example.com" className="input-modern mt-1.5" />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium" style={{ color: '#171717' }}>Email</label>
              <input value={userEmail} disabled className="input-modern mt-1.5 cursor-not-allowed opacity-60" />
            </div>

            {/* Name */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium" style={{ color: '#171717' }}>Display Name</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="input-modern mt-1.5" />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleNameSave} disabled={savingName || !displayName} className="btn-primary px-5">
                  {savingName ? 'Saving...' : 'Save Name'}
                </button>
                {nameError && <p className="text-sm font-medium text-red-600">{nameError}</p>}
                {nameSuccess && <p className="text-sm font-medium text-emerald-600">{nameSuccess}</p>}
              </div>
            </div>

            {/* Password */}
            <div className="border-t border-sage-200 pt-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-sage-500">Change Password</h3>
              <div>
                <label className="block text-sm font-medium" style={{ color: '#171717' }}>New Password</label>
                <div className="relative mt-1.5">
                  <input type={showNewPw ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="input-modern w-full pr-10" />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600">
                    {showNewPw ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium" style={{ color: '#171717' }}>Confirm New Password</label>
                <div className="relative mt-1.5">
                  <input type={showConPw ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="input-modern w-full pr-10" />
                  <button type="button" onClick={() => setShowConPw(!showConPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600">
                    {showConPw ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handlePasswordSave} disabled={savingPw || !newPassword || !confirmPassword} className="btn-primary px-5">
                  {savingPw ? 'Saving...' : 'Save Password'}
                </button>
                {pwError && <p className="text-sm font-medium text-red-600">{pwError}</p>}
                {pwSuccess && <p className="text-sm font-medium text-emerald-600">{pwSuccess}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 border-t border-sage-300 px-6 py-5">
          {tab === 'cloudflare' ? (
            <>
              <button onClick={async () => { await onSave(local); onClose() }} className="btn-primary flex-1">
                Save Changes
              </button>
              <button onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Upload Zone ─────────────────────────────────────────────────────

function UploadZone({ onUpload, inputRef }: { onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  const localRef = useRef<HTMLInputElement>(null)
  const ref = inputRef || localRef
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0]
      if (ref.current) {
        const dt = new DataTransfer()
        dt.items.add(file)
        ref.current.files = dt.files
        ref.current.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
      className={cn(
        'group relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200',
          dragging
            ? 'border-sage-500 bg-sage-500/10'
            : 'border-sage-300 bg-white hover:border-sage-400 hover:bg-sage-50/30'
      )}
    >
      <input
        ref={ref}
        type="file"
        onChange={onUpload}
        accept="image/*,video/*,application/pdf"
        className="hidden"
      />
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-100 text-sage-500 transition-transform group-hover:scale-110">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold" style={{ color: '#171717' }}>
            <span className="text-sage-500">Click to upload</span> or drag and drop
          </p>
          <p className="mt-1 text-sm text-sage-400">Images, Videos, PDFs supported</p>
        </div>
      </div>
    </div>
  )
}

// ─── Bucket Card ─────────────────────────────────────────────────────

function BucketCard({
  bucket,
  isSelected,
  onSelect,
  onDelete,
}: {
  bucket: Bucket
  isSelected: boolean
  onSelect: () => void
  onDelete: (name: string) => void
}) {
  return (
    <div
      className={cn(
        'group relative flex items-center rounded-lg px-3 py-2.5 text-left transition-all duration-200 cursor-pointer',
        isSelected
          ? 'bg-sage-100'
          : 'hover:bg-sage-50'
      )}
      onClick={onSelect}
    >
      <svg className="h-4 w-4 shrink-0 mr-2" style={{ color: '#737373' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      <p className={cn('truncate text-sm flex-1', isSelected ? 'font-semibold text-sage-900' : 'font-medium')} style={!isSelected ? { color: '#171717' } : undefined}>{bucket.Name}</p>
      {isSelected && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sage-600 shrink-0 ml-2">
          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(bucket.Name) }}
        className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-sage-400 opacity-0 transition-all duration-200 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 shrink-0"
        title="Delete bucket"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>
    </div>
  )
}

// ─── File Card ──────────────────────────────────────────────────────

function getFileType(key: string): 'image' | 'video' | 'pdf' {
  const ext = key.split('.').pop()?.toLowerCase() || ''
  if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext)) return 'video'
  if (ext === 'pdf') return 'pdf'
  return 'image'
}

function FileCard({
  file,
  bucket,
  creds,
  bucketDomain,
  onDelete,
  onOpenCopyModal,
  onOpenLightbox,
}: {
  file: FileItem
  bucket: string
  creds: R2Credentials
  bucketDomain: string
  onDelete: (key: string) => void
  onOpenCopyModal: (data: { fileName: string; linkUrl: string; embedHtml: string } | null) => void
  onOpenLightbox: (url: string) => void
}) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [shortUrl, setShortUrl] = useState<string | null>(null)
  const [loadingUrl, setLoadingUrl] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const type = getFileType(file.Key)

  useEffect(() => {
    if (bucketDomain) {
      const url = `https://${bucketDomain.replace(/^https?:\/\//, '')}/${encodeURIComponent(file.Key)}`
      setShortUrl(url)
      setFileUrl(url)
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/links?bucket=${bucket}&key=${encodeURIComponent(file.Key)}`, {
          headers: { 'x-r2-credentials': JSON.stringify(creds) },
        })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            if (!bucketDomain) {
              setFileUrl(data.url)
              if (data.shortUrl) setShortUrl(data.shortUrl)
            }
          }
        } else {
          if (!cancelled && !bucketDomain) setLoadError(true)
        }
      } catch {
        if (!cancelled && !bucketDomain) setLoadError(true)
      } finally {
        if (!cancelled) setLoadingUrl(false)
      }
    })()
    return () => { cancelled = true }
  }, [file.Key, bucket, creds, bucketDomain])

  const copyUrl = shortUrl || fileUrl || ''

  const embedTag = type === 'video'
    ? `<video controls\n  src="${escapeHtml(copyUrl)}"\n  style="max-width:100%">\n</video>`
    : type === 'pdf'
    ? `<a href="${escapeHtml(copyUrl)}" target="_blank">${escapeHtml(file.Key)}</a>`
    : `<img\n  src="${escapeHtml(copyUrl)}"\n  alt="${escapeHtml(file.Key)}"\n/>`

  return (
    <div className="group animate-fade-in-up rounded-xl border border-sage-300 bg-white transition-all duration-200 hover:shadow-md hover:border-sage-400">
      {/* Preview */}
      <div className="aspect-[4/3] overflow-hidden rounded-t-xl bg-sage-50">
        {loadingUrl ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-sage-200" />
          </div>
        ) : type === 'image' && fileUrl && !loadError ? (
          <img
            src={fileUrl}
            alt={file.Key}
            className="h-full w-full cursor-pointer object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setLoadError(true)}
            onClick={() => fileUrl && onOpenLightbox(fileUrl)}
          />
        ) : type === 'video' && fileUrl ? (
          <video
            src={fileUrl}
            className="h-full w-full object-contain cursor-pointer"
            controls
            preload="metadata"
            onClick={(e) => { e.preventDefault(); window.open(fileUrl, '_blank') }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            {type === 'pdf' ? (
              <svg className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            ) : (
              <svg className="h-10 w-10 text-sage-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            )}
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3">
        <p className="truncate text-sm font-medium text-sage-800" title={file.Key}>{file.Key}</p>
        <p className="mt-0.5 text-xs text-sage-500">{formatSize(file.Size)} · {formatDate(file.LastModified)}</p>
      </div>
      {/* Actions */}
      <div className="flex items-center justify-between border-t border-sage-200 px-3 py-2.5">
        <button
          onClick={() => onOpenCopyModal({ fileName: file.Key, linkUrl: copyUrl, embedHtml: embedTag })}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-sage-600 transition-colors hover:bg-sage-100 hover:text-sage-900"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          Share
        </button>
        <button
          onClick={() => onDelete(file.Key)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  )
}
// ─── Copy Link Modal ─────────────────────────────────────────────────

function CopyLinkModal({
  linkUrl,
  embedHtml,
  onCopy,
  onClose,
}: {
  linkUrl: string
  embedHtml: string
  onCopy: (type: 'link' | 'embed') => void
  onClose: () => void
}) {
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null)

  const handleCopy = async (type: 'link' | 'embed') => {
    const text = type === 'link' ? linkUrl : embedHtml
    await navigator.clipboard.writeText(text)
    setCopied(type)
    onCopy(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(linkUrl)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-scale-in mx-4 w-full max-w-lg rounded-2xl border border-sage-300 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-sage-200 px-6 py-4">
          <h3 className="text-lg font-bold text-sage-900">Share</h3>
          <button onClick={onClose} className="rounded-xl p-2 text-sage-400 hover:bg-sage-50 hover:text-sage-800 transition-all">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Link */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-sage-700">Link</label>
            <div className="flex gap-2">
              <div className="flex-1 overflow-x-auto whitespace-nowrap rounded-xl border border-sage-200 bg-sage-50 px-4 py-2.5 text-sm text-sage-600 font-mono">
                {linkUrl}
              </div>
              <button
                onClick={() => handleCopy('link')}
                className={cn(
                  'shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all',
                  copied === 'link'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-sage-900 text-white hover:bg-sage-800'
                )}
              >
                {copied === 'link' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Embed HTML */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-sage-700">Embed HTML</label>
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl border border-sage-200 bg-sage-900 px-4 py-3 text-sm text-green-300 leading-relaxed font-mono">
                {embedHtml}
              </pre>
              <button
                onClick={() => handleCopy('embed')}
                className={cn(
                  'absolute right-2 top-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  copied === 'embed'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                )}
              >
                {copied === 'embed' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* QR Code */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-sage-700">QR Code</label>
            <div className="flex justify-center rounded-xl border border-sage-200 bg-white p-4">
              <img
                src={qrUrl}
                alt="QR Code for link"
                className="h-40 w-40"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateBucketModal({
  open,
  creating,
  onCreate,
  onClose,
}: {
  open: boolean
  creating: boolean
  onCreate: (name: string, isPublic: boolean) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  useEffect(() => {
    if (open) { setName(''); setIsPublic(true) }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-scale-in mx-4 w-full max-w-md rounded-2xl border border-sage-300 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-sage-300 px-6 py-5">
          <h3 className="text-lg font-bold" style={{ color: '#171717' }}>Create Bucket</h3>
          <button onClick={onClose} className="rounded-xl p-2 text-sage-400 hover:bg-sage-50 hover:text-sage-800 transition-all">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-5 px-6 py-6">
          <div>
            <label className="block text-sm font-medium" style={{ color: '#171717' }}>Bucket Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-bucket"
              className="input-modern mt-1.5 w-full"
              onKeyDown={(e) => e.key === 'Enter' && name && onCreate(name, isPublic)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-sage-700 select-none">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-sage-300 text-sage-700 focus:ring-sage-500"
            />
            Public bucket (auto-enable r2.dev)
          </label>
          <button onClick={() => onCreate(name, isPublic)} disabled={creating || !name} className="btn-primary w-full">
            {creating ? 'Creating...' : 'Create Bucket'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Files Grid ──────────────────────────────────────────────────────

function FilesGrid({
  files,
  bucket,
  creds,
  bucketDomain,
  onDelete,
  onOpenCopyModal,
  onOpenLightbox,
}: {
  files: FileItem[]
  bucket: string
  creds: R2Credentials
  bucketDomain: string
  onDelete: (key: string) => void
  onOpenCopyModal: (data: { fileName: string; linkUrl: string; embedHtml: string } | null) => void
  onOpenLightbox: (url: string) => void
}) {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-100">
          <svg className="h-8 w-8" style={{ color: '#737373' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-xs" style={{ color: '#737373' }}>Upload images, videos, or PDFs to get started</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {files.map((f) => (
        <FileCard
          key={f.Key}
          file={f}
          bucket={bucket}
          creds={creds}
          bucketDomain={bucketDomain}
          onDelete={onDelete}
          onOpenCopyModal={onOpenCopyModal}
          onOpenLightbox={onOpenLightbox}
        />
      ))}
    </div>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────

function Dashboard({ addToast, accessToken }: { addToast: (t: Omit<Toast, 'id'>) => void; accessToken: string | null }) {
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [selectedBucket, setSelectedBucket] = useState<string>('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [creatingBucket, setCreatingBucket] = useState(false)
  const [loadingBuckets, setLoadingBuckets] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deletingBucket, setDeletingBucket] = useState<string | null>(null)
  const [copyModalData, setCopyModalData] = useState<{ fileName: string; linkUrl: string; embedHtml: string } | null>(null)
  const [r2Creds, setR2Creds] = useState<R2Credentials>(emptyCreds)
  const [loadingCreds, setLoadingCreds] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [userDisplayName, setUserDisplayName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [bucketDomain, setBucketDomain] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [usage, setUsage] = useState<{ totalSize: number; totalCount: number } | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [compressEnabled, setCompressEnabled] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data?.user?.user_metadata || {}
      setUserDisplayName(meta.display_name || meta.name || data?.user?.email?.split('@')[0] || 'User')
      setUserEmail(data?.user?.email || '')
    })
  }, [])

  const userInitial = (userDisplayName || 'U')[0].toUpperCase()

  const credsJson = useMemo(() => JSON.stringify(r2Creds), [r2Creds])

  // Load encrypted credentials from Supabase on mount
  useEffect(() => {
    if (!accessToken) return
    ;(async () => {
      try {
        const res = await fetch('/api/credentials', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (res.ok) {
          const data = await res.json()
          setR2Creds(data.credentials || emptyCreds())
        }
      } catch {
        setR2Creds(emptyCreds())
      } finally {
        setLoadingCreds(false)
      }
    })()
  }, [accessToken])

  const fetchBuckets = useCallback(async () => {
    if (!r2Creds.accessKeyId) return
    setLoadingBuckets(true)
    try {
      const res = await fetch('/api/buckets', { headers: { 'x-r2-credentials': credsJson } })
      const data = await res.json()
      setBuckets(data.buckets || [])
    } finally {
      setLoadingBuckets(false)
    }
  }, [r2Creds.accessKeyId, credsJson])

  const fetchFiles = useCallback(async () => {
    if (!selectedBucket || !r2Creds.accessKeyId) return
    setLoadingFiles(true)
    try {
      const res = await fetch(`/api/files?bucket=${selectedBucket}`, { headers: { 'x-r2-credentials': credsJson } })
      const data = await res.json()
      setFiles(data.files || [])
    } finally {
      setLoadingFiles(false)
    }
  }, [selectedBucket, r2Creds.accessKeyId, credsJson])

  useEffect(() => { if (r2Creds.accessKeyId) fetchBuckets() }, [fetchBuckets])
  useEffect(() => { if (selectedBucket && r2Creds.accessKeyId) fetchFiles() }, [fetchFiles])

  // Fetch storage usage
  useEffect(() => {
    if (!r2Creds.accessKeyId) return
    ;(async () => {
      try {
        const res = await fetch('/api/usage', {
          headers: { 'x-r2-credentials': JSON.stringify(r2Creds) },
        })
        if (res.ok) {
          const data = await res.json()
          setUsage({ totalSize: data.totalSize, totalCount: data.totalCount })
        }
      } catch { /* ignore */ }
    })()
  }, [r2Creds])

  // Fetch r2.dev domain for selected bucket
  useEffect(() => {
    if (!selectedBucket || !r2Creds.cloudflareApiKey) { setBucketDomain(''); return }
    ;(async () => {
      try {
        const res = await fetch(`/api/domain?bucket=${selectedBucket}`, {
          headers: { 'x-r2-credentials': JSON.stringify(r2Creds) },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.domain) setBucketDomain(data.domain)
        }
      } catch { /* ignore */ }
    })()
  }, [selectedBucket, r2Creds])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const createBucket = async (name: string, isPublic: boolean) => {
    if (!name || !r2Creds.accessKeyId) return
    setCreatingBucket(true)
    try {
      const res = await fetch('/api/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-r2-credentials': JSON.stringify(r2Creds) },
        body: JSON.stringify({ bucket: name, isPublic }),
      })
      if (res.ok) {
        const data = await res.json()
        setShowCreateModal(false)
        setBuckets((prev) => [...prev, { Name: name, CreationDate: new Date().toISOString() }])
        if (data.publicUrl) {
          setBucketDomain(data.publicUrl)
          addToast({ message: `Bucket created — public at ${data.publicUrl}/${name}/`, type: 'success' })
        } else if (data.warning) {
          addToast({ message: `Bucket "${name}" created. ${data.warning}`, type: 'info' })
        } else {
          addToast({ message: `Bucket "${name}" created`, type: 'success' })
        }
      } else {
        const err = await res.json()
        addToast({ message: err.error || 'Failed to create bucket', type: 'error' })
      }
    } finally {
      setCreatingBucket(false)
    }
  }

  const uploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedBucket || !r2Creds.accessKeyId) return
    e.target.value = ''
    setPendingFile(file)
  }

  const confirmUpload = async () => {
    const file = pendingFile
    if (!file) return
    setPendingFile(null)
    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', selectedBucket)
      formData.append('r2Credentials', JSON.stringify(r2Creds))
      formData.append('compress', compressEnabled ? '1' : '0')

      const res = await fetch('/api/files', { method: 'POST', body: formData })
      if (res.ok) {
        fetchFiles()
        addToast({ message: `"${file.name}" uploaded successfully`, type: 'success' })
      } else {
        const err = await res.json()
        addToast({ message: err.error || 'Upload failed', type: 'error' })
      }
    } catch {
      addToast({ message: 'Upload failed — network error', type: 'error' })
    } finally {
      setUploadingFile(false)
    }
  }

  const copyLink = async (key: string, type?: string) => {
    addToast({ message: type === 'embed' ? 'Embed code copied!' : 'Link copied to clipboard!', type: 'success' })
  }

  const deleteFile = async (key: string) => {
    try {
      const res = await fetch(`/api/files?bucket=${encodeURIComponent(selectedBucket)}&key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { 'x-r2-credentials': credsJson },
      })
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.Key !== key))
        addToast({ message: `"${key}" deleted`, type: 'success' })
      } else {
        addToast({ message: 'Failed to delete file', type: 'error' })
      }
    } catch {
      addToast({ message: 'Failed to delete file', type: 'error' })
    }
  }

  const deleteBucket = async (name: string) => {
    setDeletingBucket(null)
    try {
      const res = await fetch(`/api/buckets?bucket=${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { 'x-r2-credentials': credsJson },
      })
      if (res.ok) {
        setBuckets((prev) => prev.filter((b) => b.Name !== name))
        if (selectedBucket === name) {
          setSelectedBucket('')
        }
        addToast({ message: `Bucket "${name}" deleted`, type: 'success' })
      } else {
        const err = await res.json()
        addToast({ message: err.error || 'Failed to delete bucket', type: 'error' })
      }
    } catch {
      addToast({ message: 'Failed to delete bucket', type: 'error' })
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          creds={r2Creds}
          supabase={supabase}
          onSave={async (c) => {
            setR2Creds(c)
            if (!accessToken) {
              addToast({ message: 'Not authenticated', type: 'error' })
              return
            }
            try {
              const res = await fetch('/api/credentials', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(c),
              })
              if (res.ok) {
                addToast({ message: 'Credentials saved securely', type: 'success' })
              } else {
                const err = await res.json().catch(() => ({ error: 'Save failed' }))
                addToast({ message: err.error || 'Failed to save credentials', type: 'error' })
              }
            } catch {
              addToast({ message: 'Network error — failed to save credentials', type: 'error' })
            }
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Delete file confirmation modal */}
      {deleteConfirm && (
        <ConfirmModal
          message={`Are you sure you want to delete "${deleteConfirm}"?`}
          onConfirm={async () => {
            const key = deleteConfirm
            setDeleteConfirm(null)
            await deleteFile(key)
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Delete bucket confirmation modal */}
      {deletingBucket && (
        <DeleteBucketModal
          bucket={deletingBucket}
          onConfirm={() => deleteBucket(deletingBucket)}
          onCancel={() => setDeletingBucket(null)}
        />
      )}

      {/* Create bucket modal */}
      <CreateBucketModal
        open={showCreateModal}
        creating={creatingBucket}
        onCreate={createBucket}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Copy link modal */}
      {copyModalData && (
        <CopyLinkModal
          linkUrl={copyModalData.linkUrl}
          embedHtml={copyModalData.embedHtml}
          onCopy={(type) => { copyLink(copyModalData.fileName, type) }}
          onClose={() => setCopyModalData(null)}
        />
      )}

      {/* Upload confirm modal */}
      {pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setPendingFile(null)} />
          <div className="animate-scale-in mx-4 w-full max-w-sm rounded-2xl border border-sage-300 bg-white shadow-2xl">
            <div className="px-6 py-5">
              <h3 className="text-lg font-bold text-sage-900">Upload File</h3>
              <div className="mt-3 space-y-2">
                <p className="truncate text-sm font-medium text-sage-700">{pendingFile.name}</p>
                <p className="text-sm text-sage-500">{formatSize(pendingFile.size)}</p>
              </div>
              {pendingFile.type.startsWith('image/') && (
                <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-sage-200 px-4 py-3 transition-colors hover:bg-sage-50">
                  <input
                    type="checkbox"
                    checked={compressEnabled}
                    onChange={(e) => setCompressEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-sage-300 text-sage-900 focus:ring-sage-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-sage-800">Compress image</span>
                    <p className="text-xs text-sage-500">Auto-compress to ≤128 KB</p>
                  </div>
                </label>
              )}
            </div>
            <div className="flex gap-3 border-t border-sage-200 px-6 py-4">
              <button
                onClick={() => setPendingFile(null)}
                className="btn-secondary flex-1 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpload}
                className="btn-primary flex-1 py-2.5 text-sm"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)} className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src={lightboxUrl} alt="" className="max-h-screen max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Top navbar */}
      <header className="fixed top-0 z-30 w-full border-b border-sage-300 bg-white/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sage-500 hover:bg-sage-100 transition-colors md:hidden"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div>
              <h1 className="text-sm font-bold md:text-base" style={{ color: '#171717' }}>R2 Bucket Manager</h1>
              <p className="text-xs font-medium hidden sm:block" style={{ color: '#737373' }}>by only4.fun</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setShowCreateModal(true)} className="btn-primary px-3 md:px-5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="hidden sm:inline">Create</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              disabled={loadingCreds}
              className="btn-secondary px-3 md:px-5"
            >
              {loadingCreds ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
              )}
              <span className="hidden sm:inline">{loadingCreds ? 'Loading...' : 'Settings'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar + Main Content */}
      <div className="flex flex-1 pt-16">
        {/* Sidebar */}
        <aside
          className={cn(
            'flex flex-col border-r border-sage-300 bg-white',
            'w-72 shrink-0',
            'md:relative md:flex',
            sidebarOpen
              ? 'fixed inset-y-0 left-0 z-50 pt-16 animate-fade-in-up'
              : 'hidden'
          )}
        >
          {/* Buckets header */}
          <div className="flex items-center justify-between border-b border-sage-300 px-6 py-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-sage-500">Buckets</h2>
            <div className="flex items-center gap-2">
              {buckets.length > 0 && !loadingBuckets && (
                <span className="text-xs font-medium text-sage-400">{buckets.length}</span>
              )}
              <button
                onClick={() => setSidebarOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-sage-400 hover:bg-sage-100 hover:text-sage-600 transition-colors md:hidden"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bucket list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
            {loadingBuckets ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex animate-pulse items-center gap-3 rounded-lg p-3">
                    <div className="h-8 w-8 rounded-lg bg-sage-200" />
                    <div className="h-3 flex-1 rounded bg-sage-200" />
                  </div>
                ))}
              </div>
            ) : buckets.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-100">
                  <svg className="h-5 w-5" style={{ color: '#737373' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="text-xs font-medium" style={{ color: '#737373' }}>No buckets yet</p>
              </div>
            ) : (
              buckets.map((b) => (
                <BucketCard
                  key={b.Name}
                  bucket={b}
                  isSelected={selectedBucket === b.Name}
                  onSelect={() => setSelectedBucket(b.Name)}
                  onDelete={setDeletingBucket}
                />
              ))
            )}
          </div>

          {/* Storage usage */}
          {usage && (
            <div className="border-t border-sage-300 px-5 py-3">
              <div className="flex items-center justify-between text-xs text-sage-500 mb-1.5">
                <span>Storage</span>
                <span>{formatSize(usage.totalSize)} / 10 GB</span>
              </div>
              <div className="h-2 rounded-full bg-sage-100 overflow-hidden ring-1 ring-inset ring-sage-200">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min((usage.totalSize / (10 * 1024 * 1024 * 1024)) * 100, 100)}%` }} />
              </div>
              <p className="text-xs text-sage-400 mt-1">{usage.totalCount} object{usage.totalCount !== 1 ? 's' : ''}</p>
            </div>
          )}

          {/* User info */}
          <div className="flex items-center gap-3 border-t border-sage-300 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-900 text-sm font-bold text-white">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: '#171717' }}>{userDisplayName}</p>
              <p className="truncate text-xs text-sage-400">{userEmail}</p>
            </div>
            <button onClick={handleLogout} className="shrink-0 rounded-lg p-2 text-sage-400 hover:bg-sage-100 hover:text-red-500 transition-colors" title="Logout">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-sage-50/30 pb-14 md:pb-0">
          {selectedBucket ? (
            <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8 animate-fade-in-up space-y-6 md:space-y-8">
              {/* Files header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold" style={{ color: '#171717' }}>Files</h2>
                  <span className="rounded-full border border-sage-300 bg-white px-3 py-1 text-xs font-semibold text-sage-600">
                    {selectedBucket}
                  </span>
                </div>
                {!loadingFiles && files.length > 0 && (
                  <span className="text-sm font-medium text-sage-400">{files.length} file{files.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Upload zone - hidden on mobile */}
              <div className="hidden md:block">
                {uploadingFile ? (
                  <div className="overflow-hidden rounded-2xl border border-sage-300 bg-white p-8 shadow-md">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="h-8 w-8 animate-spin text-sage-600" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-sm font-medium text-sage-700">Uploading...</p>
                    </div>
                  </div>
                ) : (
                  <UploadZone onUpload={uploadFile} inputRef={fileInputRef} />
                )}
              </div>

              {/* Files grid */}
              {loadingFiles ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="animate-pulse rounded-xl border border-sage-300 bg-white overflow-hidden">
                      <div className="aspect-[4/3] bg-sage-200" />
                      <div className="p-3 space-y-2">
                        <div className="h-3 w-3/4 rounded bg-sage-200" />
                        <div className="h-2.5 w-1/2 rounded bg-sage-200" />
                      </div>
                      <div className="border-t border-sage-200 px-3 py-2.5">
                        <div className="h-3 w-16 rounded bg-sage-200" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <FilesGrid files={files} bucket={selectedBucket} creds={r2Creds} bucketDomain={bucketDomain} onDelete={(key) => setDeleteConfirm(key)} onOpenCopyModal={setCopyModalData} onOpenLightbox={(url) => setLightboxUrl(url)} />
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-5 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-sage-100 shadow-sm">
                  <svg className="h-10 w-10" style={{ color: '#737373' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-semibold" style={{ color: '#171717' }}>Select a bucket</p>
                  <p className="mt-1 text-sm text-sage-400">Choose a bucket from the sidebar to view and manage files</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile upload button */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden border-t border-sage-300 bg-white/95 backdrop-blur-sm">
        <button
          onClick={() => uploadingFile ? null : fileInputRef.current?.click()}
          disabled={uploadingFile}
          className="mx-auto flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors"
          style={{ color: uploadingFile ? '#a3a3a3' : '#525252' }}
        >
          {uploadingFile ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          )}
          {uploadingFile ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </div>
  )
}

// ─── Root Page ───────────────────────────────────────────────────────

export default function Home() {
  const [authState, setAuthState] = useState<'loading' | 'logged-in' | 'logged-out'>('loading')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { ...t, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setAccessToken(session.access_token)
      }
      setAuthState(session ? 'logged-in' : 'logged-out')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setAuthState('logged-in')
        if (session?.access_token) setAccessToken(session.access_token)
      } else if (event === 'SIGNED_OUT') {
        setAuthState('logged-out')
        setAccessToken(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#ffffff' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-sage-500/30 border-t-sage-500" />
          <p className="text-sm" style={{ color: '#737373' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (authState === 'logged-out') {
    return (
      <>
        <LoginPage onLogin={() => setAuthState('logged-in')} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    )
  }

  return (
    <>
      <Dashboard addToast={addToast} accessToken={accessToken} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}
