import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const credsHeader = request.headers.get('x-r2-credentials')
    if (!credsHeader) return NextResponse.json({ domain: null })
    const creds = JSON.parse(credsHeader)
    const { searchParams } = new URL(request.url)
    const bucket = searchParams.get('bucket')
    if (!bucket) return NextResponse.json({ domain: null })

    const cfKey = creds.cloudflareApiKey
    const cfEmail = creds.cloudflareApiEmail
    if (!cfKey || !cfEmail) return NextResponse.json({ domain: null })

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/r2/buckets/${encodeURIComponent(bucket)}/domains/managed`,
      {
        headers: { 'X-Auth-Email': cfEmail, 'X-Auth-Key': cfKey },
      }
    )

    if (!res.ok) return NextResponse.json({ domain: null })

    const data = await res.json()
    const domain = data?.result?.domain || null

    return NextResponse.json({ domain })
  } catch {
    return NextResponse.json({ domain: null })
  }
}
