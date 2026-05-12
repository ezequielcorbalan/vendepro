export interface SendWhatsappInput {
  to: string
  text: string
}

export interface SendWhatsappResult {
  messageId: string
  status: 'sent' | 'failed'
  error?: string
}

export interface WhatsappService {
  sendMessage(input: SendWhatsappInput): Promise<SendWhatsappResult>
}
