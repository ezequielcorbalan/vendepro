import type { EmailService, SendEmailInput } from '@vendepro/core'

export class EmBlueEmailService implements EmailService {
  constructor(private readonly apiKey: string) {}

  async send(input: SendEmailInput): Promise<void> {
    const res = await fetch('https://api.embluemail.com/v2.3/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    })
    if (!res.ok) {
      throw new Error(`emBlue send failed: ${res.status}`)
    }
  }
}
