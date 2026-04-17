export interface SendEmailInput {
  to: { email: string; name: string }
  from: { email: string; name: string }
  subject: string
  html: string
  text: string
}

export interface EmailService {
  send(input: SendEmailInput): Promise<void>
}
