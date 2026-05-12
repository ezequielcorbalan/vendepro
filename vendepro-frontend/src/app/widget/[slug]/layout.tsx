export const metadata = {
  title: 'Chat Widget',
  robots: { index: false, follow: false },
}

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'transparent', minHeight: '100vh' }}>
      {children}
    </div>
  )
}
