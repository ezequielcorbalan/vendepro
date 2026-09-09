'use client'
import { useState, useCallback, createContext, useContext } from 'react'
import { CheckCircle2, AlertTriangle, X, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'
type Toast = { id: number; message: string; type: ToastType }

const ToastContext = createContext<{ toast: (message: string, type?: ToastType) => void }>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-success" />,
    error: <AlertTriangle className="w-4 h-4 text-danger" />,
    warning: <AlertTriangle className="w-4 h-4 text-warning" />,
    info: <Info className="w-4 h-4 text-info" />,
  }

  const colors = {
    success: 'bg-success/10 border-success/20 text-success',
    error: 'bg-danger/10 border-danger/20 text-danger',
    warning: 'bg-warning/10 border-warning/20 text-warning',
    info: 'bg-info/10 border-info/20 text-info',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* El botón flotante de IA vive en `bottom-6 right-6` y está montado en el
          layout del dashboard, o sea en TODAS las pantallas: con el toast en
          `bottom-4` se pisaban y el mensaje quedaba tapado a la mitad. El z-index
          no alcanzaba —el toast es z-100 y el botón z-40—, porque el problema es
          que ocupan la misma esquina. El toast sube por encima del botón. */}
      <div className="fixed bottom-24 right-4 z-[100] space-y-2 max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-card border shadow-pop animate-slide-up ${colors[t.type]}`}>
            {icons[t.type]}
            <span className="text-sm flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="p-0.5 hover:opacity-70">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
