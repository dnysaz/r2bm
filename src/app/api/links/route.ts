import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Client } from '@/lib/r2-client'

function parseCreds(header: string | null) {
  return header ? JSON.parse(header) : null
}

function getShortUrl(creds: Record<string, string> | null, bucket: string, key: string) {
  if (creds?.publicUrl) return `${creds.publicUrl.replace(/\/$/, '')}/${bucket}/${key}`
  if (process.env.R2_PUBLIC_URL) return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${bucket}/${key}`
  return null
}

export async function GET(request: NextRequest) {
  try {
    const creds = parseCreds(request.headers.get('x-r2-credentials'))
    const client = getR2Client(creds)
    const { searchParams } = new URL(request.url)
    const bucket = searchParams.get('bucket')
    const key = searchParams.get('key')

    if (!bucket || !key) {
      return NextResponse.json(
        { error: 'Bucket and key parameters required' },
        { status: 400 }
      )
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })

    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 })
    const shortUrl = getShortUrl(creds, bucket, key)
    const url = shortUrl || presignedUrl

    return NextResponse.json({ url, shortUrl, presignedUrl })
  } catch (error) {
    console.error('Get link error:', error)
    return NextResponse.json(
      { error: 'Failed to generate link' },
      { status: 500 }
    )
  }
}