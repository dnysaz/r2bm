import { NextRequest, NextResponse } from 'next/server'
import { ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getR2Client } from '@/lib/r2-client'

function parseCreds(header: string | null) {
  return header ? JSON.parse(header) : null
}

export async function GET(request: NextRequest) {
  try {
    const creds = parseCreds(request.headers.get('x-r2-credentials'))
    const client = getR2Client(creds)

    const listResult = await client.send(new ListBucketsCommand({}))
    const buckets = listResult.Buckets || []

    const results: { name: string; size: number; count: number }[] = []
    let totalSize = 0
    let totalCount = 0

    for (const b of buckets) {
      let isTruncated = true
      let continuationToken: string | undefined
      let size = 0
      let count = 0

      while (isTruncated) {
        const list = await client.send(
          new ListObjectsV2Command({
            Bucket: b.Name!,
            ContinuationToken: continuationToken,
          })
        )
        const objects = list.Contents || []
        for (const obj of objects) {
          size += obj.Size || 0
          count++
        }
        isTruncated = list.IsTruncated || false
        continuationToken = list.NextContinuationToken
      }

      totalSize += size
      totalCount += count
      results.push({ name: b.Name!, size, count })
    }

    return NextResponse.json({ buckets: results, totalSize, totalCount })
  } catch (error) {
    console.error('Get usage error:', error)
    return NextResponse.json({ error: 'Failed to calculate usage' }, { status: 500 })
  }
}
