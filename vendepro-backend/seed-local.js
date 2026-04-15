// seed-local.js — Crea org + admin + agente en D1 local
const BASE_AUTH  = 'http://localhost:8787'
const BASE_ADMIN = 'http://localhost:8793'

async function seed() {
  console.log('=== VendéPro Seed Local ===\n')

  // ── 1. Crear organización + admin ──────────────────────────────
  console.log('1. Creando organización y usuario admin...')
  const orgRes = await fetch(`${BASE_AUTH}/register-org`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_name:    'Inmobiliaria Test',
      org_slug:    'test-local',
      admin_name:  'Admin Test',
      email:       'admin@test.com',
      password:    'Admin1234!',
      brand_color: '#ff007c',
    }),
  })

  if (!orgRes.ok) {
    const err = await orgRes.text()
    // Si ya existe, no es error crítico
    if (orgRes.status === 409) {
      console.log('   ↳ Org ya existente, continuando...')
    } else {
      console.error('   ✗ Error al crear org:', err)
      process.exit(1)
    }
  } else {
    const orgData = await orgRes.json()
    console.log('   ✓ Org ID:', orgData.org?.id ?? orgData.user?.org_id ?? '(ver respuesta)')
  }

  // ── 2. Login como admin para obtener token ─────────────────────
  console.log('2. Obteniendo token de admin...')
  const loginRes = await fetch(`${BASE_AUTH}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'Admin1234!' }),
  })

  if (!loginRes.ok) {
    console.error('   ✗ Login fallido:', await loginRes.text())
    process.exit(1)
  }

  const loginData = await loginRes.json()
  const token = loginData.token
  console.log('   ✓ Token obtenido')

  // ── 3. Crear agente ────────────────────────────────────────────
  console.log('3. Creando usuario agente...')
  const agentRes = await fetch(`${BASE_ADMIN}/create-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      email:    'agente@test.com',
      password: 'Agente1234!',
      name:     'Agente Test',
      phone:    '+54 11 9999-8888',
      role:     'agent',
    }),
  })

  if (!agentRes.ok) {
    const err = await agentRes.text()
    if (agentRes.status === 409) {
      console.log('   ↳ Agente ya existente, continuando...')
    } else {
      console.error('   ✗ Error al crear agente:', err)
      process.exit(1)
    }
  } else {
    const agentData = await agentRes.json()
    console.log('   ✓ Agente ID:', agentData.id ?? '(ver respuesta)')
  }

  console.log('\n=== Seed completo ===')
  console.log('Admin:  admin@test.com  /  Admin1234!')
  console.log('Agente: agente@test.com /  Agente1234!')
  console.log('URL frontend: http://localhost:3000')
}

seed().catch((e) => {
  console.error('Error inesperado:', e)
  process.exit(1)
})
