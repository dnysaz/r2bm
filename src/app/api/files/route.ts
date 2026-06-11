import { NextRequest, NextResponse } from 'next/server'
import {
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import sharp from 'sharp'
import { getR2Client } from '@/lib/r2-client'

const MAX_SIZES: Record<string, number> = {
  image: 2 * 1024 * 1024,
  video: 5 * 1024 * 1024,
  pdf: 1 * 1024 * 1024,
}
const ALLOWED_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  pdf: ['application/pdf'],
}
const COMPRESSION_TIMEOUT_MS = parseInt(process.env.COMPRESSION_TIMEOUT_MS || '5000', 10)

function getFileCategory(mime: string): 'image' | 'video' | 'pdf' | null {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'application/pdf') return 'pdf'
  return null
}

function parseCreds(header: string | null, formDataCreds?: string | null) {
  if (formDataCreds) return JSON.parse(formDataCreds)
  if (header) return JSON.parse(header)
  return null
}

function getContentType(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return 'image/png'
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46)
    return 'image/gif'
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46
  )
    return 'image/webp'
  return 'application/octet-stream'
}

const TARGET_SIZE = 128 * 1024

async function compressImage(
  buffer: Buffer,
  contentType: string
): Promise<Buffer> {
  const isSvg = buffer[0] === 0x3c && buffer[1] === 0x3f

  if (contentType === 'image/svg+xml' || isSvg) {
    return buffer
  }

  if (buffer.length <= TARGET_SIZE) {
    return buffer
  }

  try {
    const image = sharp(buffer)
    const metadata = await image.metadata()

    if (!metadata.width || !metadata.height) {
      return buffer
    }

    const outputFormat = metadata.format === 'gif' ? 'gif' : 'webp'

    let quality = 80
    let result = buffer

    while (quality >= 10) {
      const compressed = await image
        .clone()
        .toFormat(outputFormat, { quality })
        .toBuffer()

      if (compressed.length <= TARGET_SIZE) {
        result = compressed
        break
      }

      result = compressed
      quality -= 10
    }

    if (result.length > TARGET_SIZE && metadata.width && metadata.height) {
      for (const scale of [0.75, 0.5, 0.25]) {
        const resized = await image
          .clone()
          .resize(Math.round(metadata.width * scale), Math.round(metadata.height * scale), { fit: 'inside' })
          .toFormat(outputFormat, { quality: 60 })
          .toBuffer()

        if (resized.length <= TARGET_SIZE) {
          result = resized
          break
        }
        result = resized
      }
    }

    return result
  } catch {
    return buffer
  }
}

export async function GET(request: NextRequest) {
  try {
    const creds = parseCreds(request.headers.get('x-r2-credentials'))
    const client = getR2Client(creds)
    const { searchParams } = new URL(request.url)
    const bucket = searchParams.get('bucket')
    const prefix = searchParams.get('prefix') || ''

    if (!bucket) {
      return NextResponse.json(
        { error: 'Bucket parameter required' },
        { status: 400 }
      )
    }

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    })

    const response = await client.send(command)
    return NextResponse.json({ files: response.Contents || [] })
  } catch (error) {
    console.error('List files error:', error)
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const bucket = formData.get('bucket') as string
    const r2Credentials = formData.get('r2Credentials') as string
    const compress = formData.get('compress') === '1'
    const client = getR2Client(parseCreds(null, r2Credentials))

    if (!file || !bucket) {
      return NextResponse.json(
        { error: 'File and bucket required' },
        { status: 400 }
      )
    }

    const contentType = file.type || getContentType(Buffer.from(await file.arrayBuffer()))
    const category = getFileCategory(contentType)

    if (!category) {
      return NextResponse.json(
        { error: 'Only images, videos, and PDFs are allowed' },
        { status: 400 }
      )
    }

    const maxSize = MAX_SIZES[category]
    if (file.size > maxSize) {
      const labels = { image: '2 MB', video: '5 MB', pdf: '1 MB' }
      return NextResponse.json(
        { error: `File size exceeds ${labels[category]}` },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const originalBuffer = Buffer.from(arrayBuffer)

    const bodyBuffer = compress && category === 'image'
      ? await Promise.race([
          compressImage(originalBuffer, contentType),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Compression timed out')), COMPRESSION_TIMEOUT_MS)
          ),
        ]).catch(() => originalBuffer)
      : originalBuffer

    const key = file.name

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bodyBuffer,
      ContentType: contentType,
    })

    await client.send(command)
    return NextResponse.json({ success: true, key })
  } catch (error) {
    console.error('Upload file error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })

    await client.send(command)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete file error:', error)
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const creds = parseCreds(request.headers.get('x-r2-credentials'))
    const client = getR2Client(creds)
    const { bucket, key } = await request.json()

    if (!bucket || !key) {
      return NextResponse.json(
        { error: 'Bucket and key required' },
        { status: 400 }
      )
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })

    const url = await getSignedUrl(client, command, { expiresIn: 3600 })
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Presign URL error:', error)
    return NextResponse.json(
      { error: 'Failed to generate URL' },
      { status: 500 }
    )
  }
}