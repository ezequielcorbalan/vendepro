import { redirect } from 'next/navigation'
import { getCurrentUserServer } from '@/lib/auth-server'

export default async function HomePage() {
  const user = await getCurrentUserServer()
  redirect(user ? '/dashboard' : '/login')
}
