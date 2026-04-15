'use client'
import { useState, useEffect } from 'react'
import { User, Lock, Save, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/api'
import { getCurrentUser, setCurrentUser } from '@/lib/auth'

export default function PerfilPage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    apiFetch('admin', '/profile').then(r => r.json() as Promise<any>).then(d => {
      setProfile(d)
      setFullName(d.full_name || '')
      setPhone(d.phone || '')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await apiFetch('admin', '/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: fullName, phone }),
      })
      const data = (await res.json()) as any
      if (data.error) {
        toast(data.error, 'error')
      } else {
        toast('Perfil actualizado')
        // Update local user cache
        const u = getCurrentUser()
        if (u) setCurrentUser({ ...u, full_name: fullName, name: fullName, phone })
      }
    } catch { toast('Error', 'error') }
    finally { setSavingProfile(false) }
  }

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { toast('Las contraseñas no coinciden', 'error'); return }
    if (newPw.length < 6) { toast('Mínimo 6 caracteres', 'error'); return }
    setSavingPw(true)
    try {
      const res = await apiFetch('auth', '/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      })
      const data = (await res.json()) as any
      if (data.error) { toast(data.error, 'error') }
      else { toast('Contraseña cambiada'); setCurrentPw(''); setNewPw(''); setConfirmPw('') }
    } catch { toast('Error', 'error') }
    finally { setSavingPw(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Mi Perfil</h1>
        <p className="text-gray-500 text-sm mt-1">Información personal y configuración de seguridad</p>
      </div>

      {/* Profile section */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-[#ff007c]" /> Información personal
        </h2>
        <div className="space-y-4">
          {profile?.photo_url && (
            <div className="flex items-center gap-4">
              <img src={profile.photo_url} alt={fullName} className="w-16 h-16 rounded-full object-cover" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={profile?.email || ''} disabled
              className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
          </div>
          <button onClick={handleSaveProfile} disabled={savingProfile}
            className="flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar cambios
          </button>
        </div>
      </div>

      {/* Password section */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#ff007c]" /> Cambiar contraseña
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
            <input type={showPw ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]" />
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]" />
            <button onClick={() => setShowPw(!showPw)} className="absolute right-3 bottom-2 text-gray-400">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]" />
          </div>
          {newPw && confirmPw && (
            <div className={`text-xs flex items-center gap-1 ${newPw === confirmPw ? 'text-green-600' : 'text-red-500'}`}>
              <CheckCircle2 className="w-3 h-3" />
              {newPw === confirmPw ? 'Contraseñas coinciden' : 'No coinciden'}
            </div>
          )}
          <button onClick={handleChangePassword} disabled={savingPw || !currentPw || !newPw || newPw !== confirmPw}
            className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
            {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Cambiar contraseña
          </button>
        </div>
      </div>
    </div>
  )
}
