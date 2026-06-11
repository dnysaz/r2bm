import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/encryption'

export interface R2CredentialsInput {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  publicUrl: string
  cloudflareApiKey: string
  cloudflareApiEmail: string
}

/** Create an authenticated Supabase client from a Bearer token */
function getAuthClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  )
}

// GET /api/credentials — Load encrypted credentials for current user
export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAuthClient(auth.slice(7))
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('r2_credentials')
      .select('encrypted_data')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Supabase query error:', error)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ credentials: null })
    }

    try {
      const parsed = JSON.parse(data.encrypted_data)
      const plaintext = decrypt({
        encrypted: parsed.encrypted,
        iv: parsed.iv,
        tag: parsed.tag,
      })
      return NextResponse.json({ credentials: JSON.parse(plaintext) })
    } catch {
      return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 })
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/credentials — Save encrypted credentials for current user
export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAuthClient(auth.slice(7))
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: R2CredentialsInput = await request.json()
    if (!body.accessKeyId || !body.secretAccessKey) {
      return NextResponse.json({ error: 'Access Key ID and Secret Access Key are required' }, { status: 400 })
    }

    const { encrypted, iv, tag } = encrypt(JSON.stringify(body))
    const encryptedPayload = JSON.stringify({ encrypted, iv, tag })

    const { error } = await supabase.from('r2_credentials').upsert(
      { user_id: user.id, encrypted_data: encryptedPayload },
      { onConflict: 'user_id' }
    )

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/credentials — Delete credentials for current user
export async function DELETE(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAuthClient(auth.slice(7))
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('r2_credentials')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Supabase delete error:', error)
      return NextResponse.json({ error: 'Failed to delete credentials' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
