import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = process.env.ENCRYPTION_KEY

function getKey(): Buffer {
  if (!KEY) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(KEY, 'hex')
}

export interface EncryptedData {
  encrypted: string // hex
  iv: string // hex
  tag: string // hex
}

export function encrypt(plaintext: string): EncryptedData {
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag,
  }
}

export function decrypt(data: EncryptedData): string {
  const key = getKey()
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(data.iv, 'hex')
  )
  decipher.setAuthTag(Buffer.from(data.tag, 'hex'))

  let plaintext = decipher.update(data.encrypted, 'hex', 'utf8')
  plaintext += decipher.final('utf8')
  return plaintext
}
