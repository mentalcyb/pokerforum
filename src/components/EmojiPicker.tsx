'use client'
import { useEffect, useRef, useState } from 'react'

const EMOJI_GROUPS = [
  {
    label: 'სახეები',
    emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'],
  },
  {
    label: 'ხელები',
    emojis: ['👍','👎','👌','🤌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐️','✋','🖖','🤝','🙏','✍️','💪','🦾','👏','🙌','🤲','🫶','❤️‍🔥'],
  },
  {
    label: 'გულები',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫀'],
  },
  {
    label: 'პოკერი',
    emojis: ['♠️','♥️','♦️','♣️','🃏','🎰','🎲','🎯','💰','💵','💴','💶','💷','💸','🏆','🥇','🥈','🥉','🎖️','🏅','👑','💎','🤑','🤫','😈','🦊','🐍','🔥','⚡','💥','🎭','🕶️','🥸','🤠','😤','😎'],
  },
  {
    label: 'სხვა',
    emojis: ['🚀','⭐','🌟','✨','💫','🎉','🎊','🎈','🎁','🎮','🕹️','🏋️','⚽','🏀','🏈','⚾','🎾','🏐','🎱','🍀','🌹','🌺','🌸','🌻','🌈','🌙','☀️','⛅','🌊','🔥','❄️','💧','🌿','🍃','🍕','🍔','🍟','🌮','🍜','🍣','🍺','🥂','☕','🧃'],
  },
]

interface Props {
  onSelect: (emoji: string) => void
}

export default function EmojiPicker({ onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function pick(emoji: string) {
    onSelect(emoji)
    // keep picker open for rapid selection
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-base"
        title="Emoji"
      >
        😊
      </button>

      {open && (
        <div className="absolute bottom-10 left-0 z-50 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
            {EMOJI_GROUPS.map((g, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setTab(i)}
                className={`flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors ${
                  tab === i
                    ? 'text-brand-600 border-b-2 border-brand-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="p-2 grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
            {EMOJI_GROUPS[tab].emojis.map((emoji, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pick(emoji)}
                className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
