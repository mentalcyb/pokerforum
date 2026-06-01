'use client'
import React from 'react'

// Extracts YouTube video ID from any common URL format
function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url)
    // youtu.be/VIDEO_ID
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0]
      return id || null
    }
    // youtube.com/watch?v=VIDEO_ID
    if (parsed.hostname.endsWith('youtube.com')) {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v')
      // youtube.com/embed/VIDEO_ID  or  youtube.com/shorts/VIDEO_ID
      const match = parsed.pathname.match(/^\/(embed|shorts|v)\/([^/?]+)/)
      if (match) return match[2]
    }
  } catch {
    // not a valid URL
  }
  return null
}

// URL regex — matches http(s) links in plain text
const URL_REGEX = /https?:\/\/[^\s<>"]+/g

interface Segment {
  type: 'text' | 'youtube' | 'link'
  value: string       // original text / url
  videoId?: string    // only for youtube segments
}

function parseContent(text: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_REGEX)) {
    const url = match[0]
    const start = match.index!

    // Push any plain text before this URL
    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) })
    }

    const videoId = extractYouTubeId(url)
    if (videoId) {
      segments.push({ type: 'youtube', value: url, videoId })
    } else {
      segments.push({ type: 'link', value: url })
    }

    lastIndex = start + url.length
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments
}

interface Props {
  content: string
  className?: string
}

export default function ContentRenderer({ content, className = '' }: Props) {
  const segments = parseContent(content)

  return (
    <div className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'youtube') {
          return (
            <div key={i} className="my-3">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${seg.videoId}`}
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full rounded-lg"
                />
              </div>
            </div>
          )
        }
        if (seg.type === 'link') {
          return (
            <a
              key={i}
              href={seg.value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline break-all"
            >
              {seg.value}
            </a>
          )
        }
        // plain text — preserve newlines
        return (
          <span key={i} className="whitespace-pre-wrap">
            {seg.value}
          </span>
        )
      })}
    </div>
  )
}
