import type { Metadata } from 'next'

// Private tables (invite links) should never show up in search results.
export const metadata: Metadata = {
  title: 'პოკერის მაგიდა | pokerforum.ge',
  robots: { index: false, follow: false },
}

export default function TableLayout({ children }: { children: React.ReactNode }) {
  return children
}
