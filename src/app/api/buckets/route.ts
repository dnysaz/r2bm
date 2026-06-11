import { NextRequest, NextResponse } from 'next/server'
import {
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { getR2Client } from '@/lib/r2-client'

function parseCreds(header: string | null) {
  return header ? JSON.parse(header) : null
}

export async function GET(request: NextRequest) {
  try {
    const creds = parseCreds(request.headers.get('x-r2-credentials'))
    const client = getR2Client(creds)

    const command = new ListBucketsCommand({})
    const response = await client.send(command)
    return NextResponse.json({ buckets: response.Buckets || [] })
  } catch (error) {
    console.error('List buckets error:', error)
    return NextResponse.json(
      { error: 'Failed to list buckets' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const creds = parseCreds(request.headers.get('x-r2-credentials'))
    const client = getR2Client(creds)

    const { bucket, isPublic } = await request.json()

    if (!bucket) {
      return NextResponse.json(
        { error: 'Bucket name required' },
        { status: 400 }
      )
    }

    const createCommand = new CreateBucketCommand({ Bucket: bucket })
    await client.send(createCommand)

    if (isPublic) {
      // Auto-enable r2.dev public URL via Cloudflare API
      const cfKey = creds?.cloudflareApiKey
      const cfEmail = creds?.cloudflareApiEmail
      let publicUrl = null
      let publicWarning = null
      if (cfKey && cfEmail) {
        const cfRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/r2/buckets/${encodeURIComponent(bucket)}/domains/managed`,
          {
            method: 'PUT',
            headers: {
              'X-Auth-Email': cfEmail,
              'X-Auth-Key': cfKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ enabled: true }),
          }
        )
        if (cfRes.ok) {
          const cfData = await cfRes.json()
          publicUrl = cfData?.result?.domain
        } else {
          const cfErr = await cfRes.text()
          console.warn('Cloudflare API error:', cfErr)
          publicWarning = `Bucket created but failed to enable public URL: ${cfErr}`
        }
      } else {
        publicWarning = 'Cloudflare API credentials not configured — set them in Settings to auto-enable public URL'
      }

      return NextResponse.json({ success: true, publicUrl, warning: publicWarning })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Create bucket error:', error)
    return NextResponse.json(
      { error: 'Failed to create bucket' },
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

    if (!bucket) {
      return NextResponse.json(
        { error: 'Bucket parameter required' },
        { status: 400 }
      )
    }

    // Empty the bucket first: list all objects and delete in batches
    let isTruncated = true
    let continuationToken: string | undefined

    while (isTruncated) {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
      const listResult = await client.send(listCommand)

      const objects = listResult.Contents || []
      if (objects.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objects.map((obj) => ({ Key: obj.Key! })),
            Quiet: true,
          },
        })
        await client.send(deleteCommand)
      }

      isTruncated = listResult.IsTruncated || false
      continuationToken = listResult.NextContinuationToken
    }

    const deleteCommand = new DeleteBucketCommand({ Bucket: bucket })
    await client.send(deleteCommand)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete bucket error:', error)
    return NextResponse.json(
      { error: 'Failed to delete bucket' },
      { status: 500 }
    )
  }
}