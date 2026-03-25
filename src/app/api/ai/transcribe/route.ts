import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getEnvVar } from '@/lib/db'

// POST /api/ai/transcribe — audio → text via Groq Whisper
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const groqKey = await getEnvVar('GROQ_API_KEY')
  if (!groqKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })

  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    if (!audioFile) return NextResponse.json({ error: 'No audio file' }, { status: 400 })

    // Check size (max 25MB for Groq Whisper)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio demasiado largo (máx 25MB)' }, { status: 400 })
    }

    // Forward to Groq Whisper API
    const groqForm = new FormData()
    groqForm.append('file', audioFile)
    groqForm.append('model', 'whisper-large-v3')
    groqForm.append('language', 'es')
    groqForm.append('response_format', 'json')

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey}` },
      body: groqForm,
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Transcription failed: ${err}` }, { status: 500 })
    }

    const data = (await res.json()) as any
    return NextResponse.json({
      text: data.text || '',
      duration: data.duration || null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
