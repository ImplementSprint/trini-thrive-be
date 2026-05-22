export function getStorageUrl(bucket: string, key: string | null | undefined): string | null {
  if (!key || typeof key !== 'string' || key.trim() === '') return null;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;

  const safeKey = key.replace(/\.\.\//g, '').replace(/^\/+/, '').trim();
  if (safeKey === '' || safeKey === 'cover-images/campaigns/') return null;

  let finalBucket = bucket;
  let finalPath = safeKey;

  if (bucket.toLowerCase() === 'campaigns') {
    finalBucket = 'camp-man-files';
    const prefix = 'cover-images/campaigns/';
    finalPath = safeKey.startsWith(prefix) ? safeKey : `${prefix}${safeKey}`;
  }

  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${finalBucket}/${finalPath}`;
}
