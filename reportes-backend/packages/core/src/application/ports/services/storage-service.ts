export interface StorageService {
  upload(key: string, data: ArrayBuffer, contentType: string): Promise<string>
  delete(key: string): Promise<void>
  getUrl(key: string): string
}
