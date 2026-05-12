import type { WhatsappService, SendWhatsappInput, SendWhatsappResult } from '@vendepro/core'

export class CallbellWhatsappService implements WhatsappService {
  constructor(private readonly apiToken: string) {}

  async sendMessage(input: SendWhatsappInput): Promise<SendWhatsappResult> {
    const res = await fetch('https://api.callbell.eu/v1/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: input.to,
        from: 'whatsapp',
        type: 'text',
        content: { text: input.text },
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      return { messageId: '', status: 'failed', error: `Callbell ${res.status}: ${errText}` }
    }

    const data = (await res.json()) as any
    return { messageId: data?.message?.uuid ?? data?.uuid ?? '', status: 'sent' }
  }
}
