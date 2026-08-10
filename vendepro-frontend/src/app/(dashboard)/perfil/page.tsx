'use client'
import { useState, useEffect } from 'react'
import { User, Lock, Save, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input, Field } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
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
    <div className="space-y-6">
      <div>
        <Heading level={2} as="h1">Mi Perfil</Heading>
        <Text tone="muted" className="mt-1">Información personal y configuración de seguridad</Text>
      </div>

      {/* Profile section */}
      <Card padded={false} className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-primary" />
          <Heading level={4} as="h2">Información personal</Heading>
        </div>
        <div className="space-y-4">
          {profile?.photo_url && (
            <div className="flex items-center gap-4">
              <img src={profile.photo_url} alt={fullName} className="w-16 h-16 rounded-full object-cover" />
            </div>
          )}
          <Field label="Nombre completo" htmlFor="fullName">
            <Input id="fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)} />
          </Field>
          <Field label="Teléfono" htmlFor="phone">
            <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="email" hint="El email no se puede modificar">
            <Input id="email" type="email" value={profile?.email || ''} disabled />
          </Field>
          <Button onClick={handleSaveProfile} loading={savingProfile} icon={<Save className="w-4 h-4" />}>
            Guardar cambios
          </Button>
        </div>
      </Card>

      {/* Password section */}
      <Card padded={false} className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-primary" />
          <Heading level={4} as="h2">Cambiar contraseña</Heading>
        </div>
        <div className="space-y-4">
          <Field label="Contraseña actual" htmlFor="currentPw">
            <Input id="currentPw" type={showPw ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
          </Field>
          <Field label="Nueva contraseña" htmlFor="newPw">
            <div className="relative">
              <Input id="newPw" type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} className="pr-10" />
              <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Ocultar' : 'Mostrar'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirmar contraseña" htmlFor="confirmPw">
            <Input id="confirmPw" type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
          </Field>
          {newPw && confirmPw && (
            <Text size="xs" tone={newPw === confirmPw ? 'success' : 'danger'} className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {newPw === confirmPw ? 'Contraseñas coinciden' : 'No coinciden'}
            </Text>
          )}
          <Button
            variant="outline"
            onClick={handleChangePassword}
            loading={savingPw}
            disabled={savingPw || !currentPw || !newPw || newPw !== confirmPw}
            icon={<Lock className="w-4 h-4" />}
          >
            Cambiar contraseña
          </Button>
        </div>
      </Card>
    </div>
  )
}
