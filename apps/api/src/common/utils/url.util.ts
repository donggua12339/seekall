import { createHash } from 'crypto'

export class UrlUtil {
  static hash(url: string): string {
    return createHash('md5').update(url).digest('hex')
  }

  static normalize(url: string): string {
    return url.trim().replace(/\/$/, '')
  }
}
