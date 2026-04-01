'use client'
import { useState, useEffect } from 'react'
import { User, Lock, Save, Loader2, CheckCircle2, Eye, EyeOff, Video } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function PerfilPage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Profile fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Video settings
  const [videoComercial, setVideoComercial] = useState('')
  const [videoMercado, setVideoMercado] = useState('')
  const [savingVideos, setSavingVideos] = useState(false)

  // Password fields
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json() as Promise<any>).then(d => {
      setProfile(d)
      setFullName(d.full_name || '')
      setPhone(d.phone || '')
      setLoading(false)
    }).catch(() => setLoading(false))
    // Load agent video settings
    fetch('/api/agent-settings').then(r => r.json() as Promise<any>).then(d => {
      setVideoComercial(d.video_propuesta_comercial || '')
      setVideoMercado(d.video_situacion_mercado || '')
    }).catch(() => {})
  }, [])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, phone }),
      })
      const data = (await res.json()) as any
      if (data.error) { toast(data.error, 'error') } else { toast('Perfil actualizado', 'success') }
    } catch { toast('Error', 'error') }
    finally { setSavingProfile(false) }
  }

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { toast('Las contrase\u00f1as no coinciden', 'error'); return }
    if (newPw.length < 6) { toast('M\u00ednimo 6 caracteres', 'error'); return }
    setSavingPw(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      })
      const data = (await res.json()) as any
      if (data.error) {
        toast(data.error, 'error')
      } else {
        toast('Contrase\u00f1a actualizada', 'success')
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
      }
    } catch { toast('Error', 'error') }
    finally { setSavingPw(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#ff007c] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <User className="w-6 h-6 text-[#ff007c]" /> Mi perfil
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">{profile?.email}</p>
      </div>

      {/* Profile info */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" /> Datos personales
        </h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tel&eacute;fono</label>
          <input value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c]"
            placeholder="+5411..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input value={profile?.email || ''} disabled
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
          <input value={profile?.role === 'admin' ? 'Administrador' : profile?.role === 'owner' ? 'Due\u00f1o' : 'Agente'} disabled
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
        </div>
        <button onClick={handleSaveProfile} disabled={savingProfile}
          className="w-full bg-[#ff007c] text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </button>
      </div>

      {/* My videos for tasaciones */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Video className="w-4 h-4 text-[#ff007c]" /> Mis videos para tasaciones
        </h2>
        <p className="text-xs text-gray-400">Estos videos se muestran en las landings de tasaci&oacute;n que cre&eacute;s. Cada agente configura los suyos.</p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Video propuesta comercial</label>
          <input value={videoComercial} onChange={e => setVideoComercial(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c]"
            placeholder="https://www.youtube.com/embed/..." />
          <p className="text-[10px] text-gray-400 mt-1">URL embed de YouTube. Ej: https://www.youtube.com/embed/VIDEO_ID</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Video situaci&oacute;n de mercado</label>
          <input value={videoMercado} onChange={e => setVideoMercado(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c]"
            placeholder="https://www.youtube.com/embed/..." />
        </div>
        <button onClick={async () => {
          setSavingVideos(true)
          try {
            await fetch('/api/agent-settings', {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ video_propuesta_comercial: videoComercial, video_situacion_mercado: videoMercado }),
            })
            toast('Videos guardados', 'success')
          } catch { toast('Error', 'error') }
          finally { setSavingVideos(false) }
        }} disabled={savingVideos}
          className="w-full bg-[#ff007c] text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          {savingVideos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
          Guardar videos
        </button>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-400" /> Cambiar contrase&ntilde;a
        </h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contrase&ntilde;a actual</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-10 focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c]" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contrase&ntilde;a</label>
          <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c]"
            placeholder="M\u00ednimo 6 caracteres" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar nueva contrase&ntilde;a</label>
          <input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c]" />
          {confirmPw && newPw !== confirmPw && (
            <p className="text-[10px] text-red-500 mt-1">Las contrase&ntilde;as no coinciden</p>
          )}
        </div>
        <button onClick={handleChangePassword} disabled={savingPw || !currentPw || !newPw || newPw !== confirmPw}
          className="w-full bg-gray-800 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40 flex items-center justify-center gap-2">
          {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          Cambiar contrase&ntilde;a
        </button>
      </div>
    </div>
  )
}
