// The PIN is a local device convenience gate layered on top of the real Supabase
// session, not the actual auth mechanism — so hashing it locally (never sent
// anywhere) is enough. SHA-256 via Web Crypto, hex-encoded.
export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(pin)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
