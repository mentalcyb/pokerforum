import { NextRequest } from 'next/server'

// Cloudflare's published edge ranges (https://www.cloudflare.com/ips/). pokerforum.ge goes through
// Cloudflare, so the address Vercel sees is Cloudflare's, and the visitor's is in CF-Connecting-IP.
const CF_V4: [string, number][] = [
  ['173.245.48.0', 20], ['103.21.244.0', 22], ['103.22.200.0', 22], ['103.31.4.0', 22], ['141.101.64.0', 18],
  ['108.162.192.0', 18], ['190.93.240.0', 20], ['188.114.96.0', 20], ['197.234.240.0', 22], ['198.41.128.0', 17],
  ['162.158.0.0', 15], ['104.16.0.0', 13], ['104.24.0.0', 14], ['172.64.0.0', 13], ['131.0.72.0', 22],
]
const CF_V6 = ['2400:cb00:', '2606:4700:', '2803:f800:', '2405:b500:', '2405:8100:', '2a06:98c0:', '2c0f:f248:']

function v4ToInt(ip: string): number | null {
  const p = ip.split('.').map(Number)
  return p.length === 4 && p.every(n => n >= 0 && n <= 255) ? ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3] : null
}
function isCloudflare(ip: string): boolean {
  if (ip.includes(':')) return CF_V6.some(pre => ip.toLowerCase().startsWith(pre))
  const n = v4ToInt(ip)
  if (n === null) return false
  return CF_V4.some(([base, bits]) => {
    const b = v4ToInt(base)!
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
    return ((n & mask) >>> 0) === ((b & mask) >>> 0)
  })
}

/** The visitor's real IP address. */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || ''
  // Only believe Cloudflare's header when the request really came through Cloudflare
  // (otherwise anyone could send a fake one straight to the server).
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf && (!forwarded || isCloudflare(forwarded))) return cf
  return forwarded || 'unknown'
}
