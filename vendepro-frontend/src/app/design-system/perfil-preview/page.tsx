'use client'
import { useState } from 'react'
import { User, Lock, Save, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Field } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'

/**
 * PREVIEW SÓLO PARA REVISIÓN — copia visual de la pantalla /perfil migrada,
 * con datos de ejemplo y sin llamadas al backend. Misma composición de
 * componentes del DS que la pantalla real. Borrable.
 */
export default function PerfilPreviewPage() {
  const [fullName, setFullName] = useState('Marcela Genta')
  const [phone, setPhone] = useState('+54 11 5555 1234')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)

  return (
    <div className="min-h-screen bg-brand-light">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <Text size="xs" tone="muted" className="uppercase tracking-widest">Preview · pantalla migrada (datos de ejemplo)</Text>

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
            <Field label="Nombre completo" htmlFor="fullName">
              <Input id="fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)} />
            </Field>
            <Field label="Teléfono" htmlFor="phone">
              <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="email" hint="El email no se puede modificar">
              <Input id="email" type="email" value="marcela@genta.com.ar" disabled />
            </Field>
            <Button icon={<Save className="w-4 h-4" />}>Guardar cambios</Button>
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
                {newPw === confirmPw ? 'Contraseñas coinciden' : 'No coinciden'}
              </Text>
            )}
            <Button variant="outline" icon={<Lock className="w-4 h-4" />}>Cambiar contraseña</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
