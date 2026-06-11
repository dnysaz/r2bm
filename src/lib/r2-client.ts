import { S3Client } from '@aws-sdk/client-s3'

const clientCache = new Map<string, S3Client>()

interface R2Creds {
  endpoint?: string
  accessKeyId?: string
  secretAccessKey?: string
}

function cacheKey(creds: R2Creds | null): string {
  const endpoint = creds?.endpoint || process.env.R2_ENDPOINT || ''
  const accessKeyId = creds?.accessKeyId || process.env.R2_ACCESS_KEY_ID || ''
  // include checksum option version in cache key to avoid conflict when config changes
  return `${endpoint}:${accessKeyId}:checksum-off`
}

export function getR2Client(creds?: R2Creds | null): S3Client {
  const key = cacheKey(creds ?? null)

  if (!clientCache.has(key)) {
    clientCache.set(
      key,
      new S3Client({
        region: 'auto',
        endpoint: creds?.endpoint || process.env.R2_ENDPOINT!,
        credentials: {
          accessKeyId: creds?.accessKeyId || process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: creds?.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY!,
        },
        // R2 tidak mendukung flexible checksums — nonaktifkan biar signature cocok
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      })
    )
  }

  return clientCache.get(key)!
}
