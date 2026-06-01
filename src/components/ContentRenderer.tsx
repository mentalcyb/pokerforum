'use client'
import React from 'react'

// ── YouTube ──────────────────────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  try {
    const p = new URL(url)
    if (p.hostname === 'youtu.be') return p.pathname.slice(1).split('/')[0] || null
    if (p.hostname.endsWith('youtube.com')) {
      if (p.pathname === '/watch') return p.searchParams.get('v')
      const m = p.pathname.match(/^\/(embed|shorts|v)\/([^/?]+)/)
      if (m) return m[2]
    }
  } catch { /* not a URL */ }
  return null
}

// ── Image detection ───────────────────────────────────────────────────────────
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?.*)?$/i

function isImageUrl(url: string): boolean {
  try {
    const p = new URL(url)
    // Extension-based
    if (IMAGE_EXT.test(p.pathname)) return true
    // Supabase storage public URLs
    if (p.pathname.includes('/storage/v1/object/public/')) return true
  } catch { /* not a URL */ }
  return false
}

// ── Segment parser ────────────────────────────────────────────────────────────
const URL_REGEX = /https?:\/\/[^\s<>"]+/g

type Segment =
  | { type: 'text';    value: string }
  | { type: 'youtube'; value: string; videoId: string }
  | { type: 'image';   value: string }
  | { type: 'link';    value: string }

function parseContent(text: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0
  const re = new RegExp(URL_REGEX.source, 'g')
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    const url = match[0]
    const start = match.index

    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) })
    }

    const videoId = extractYouTubeId(url)
    if (videoId) {
      segments.push({ type: 'youtube', value: url, videoId })
    } else if (isImageUrl(url)) {
      segments.push({ type: 'image', value: url })
    } else {
      segments.push({ type: 'link', value: url })
    }

    lastIndex = re.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { content: string; className?: string }

export default function ContentRenderer({ content, className = '' }: Props) {
  return (
    <div className={className}>
      {parseContent(content).map((seg, i) => {
        if (seg.type === 'youtube') {
          return (
            <div key={i} className="my-3">
              <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${seg.videoId}`}
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </div>
          )
        }

        if (seg.type === 'image') {
          return (
            <div key={i} className="my-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={seg.value}
                alt="user uploaded image"
                className="max-w-full rounded-lg border border-gray-200 dark:border-gray-700"
                style={{ maxHeight: '480px', objectFit: 'contain' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          )
        }

        if (seg.type === 'link') {
          return (
            <a key={i} href={seg.value} target="_blank" rel="noopener noreferrer"
              className="text-brand-600 hover:underline break-all">
              {seg.value}
            </a>
          )
        }

        return <span key={i} className="whitespace-pre-wrap">{seg.value}</span>
      })}
    </div>
  )
}
