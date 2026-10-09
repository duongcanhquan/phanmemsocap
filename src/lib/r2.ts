import type { S3Client } from '@aws-sdk/client-s3'

const accountId = import.meta.env.VITE_R2_ACCOUNT_ID
const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID
const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY
const bucket = import.meta.env.VITE_R2_BUCKET
const publicUrl = import.meta.env.VITE_R2_PUBLIC_URL

export const isR2Configured = Boolean(
  accountId && accessKeyId && secretAccessKey && bucket && publicUrl,
)

let client: S3Client | null = null

async function getClient() {
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing Cloudflare R2 credentials')
  }

  if (!client) {
    const { S3Client: createS3Client } = await import('@aws-sdk/client-s3')
    client = new createS3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }

  return client
}

export async function uploadToR2(file: File): Promise<string> {
  if (!bucket || !publicUrl) {
    throw new Error('Missing Cloudflare R2 bucket configuration')
  }

  const safeName = file.name.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 80)
  const key = `lessons/${crypto.randomUUID()}-${safeName || 'image'}`

  const { PutObjectCommand } = await import('@aws-sdk/client-s3')
  await (await getClient()).send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(await file.arrayBuffer()),
      ContentType: file.type || 'application/octet-stream',
    }),
  )

  return `${publicUrl.replace(/\/$/, '')}/${key}`
}
