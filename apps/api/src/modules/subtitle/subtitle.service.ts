import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface SubtitleResult {
  title: string
  language: string
  downloadUrl: string
  rating: number
  releaseName: string
  uploadDate: string
}

@Injectable()
export class SubtitleService {
  private readonly logger = new Logger(SubtitleService.name)
  private readonly apiKey: string
  private readonly apiUrl = 'https://api.opensubtitles.com/api/v1'

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENSUBTITLES_API_KEY', '')
  }

  get enabled(): boolean {
    return !!this.apiKey
  }

  async search(keyword: string, language: string = 'zh,en', limit: number = 10): Promise<SubtitleResult[]> {
    if (!this.enabled) {
      this.logger.debug('OpenSubtitles API key not configured')
      return []
    }

    try {
      const url = new URL(`${this.apiUrl}/subtitles`)
      url.searchParams.set('query', keyword)
      url.searchParams.set('languages', language)
      url.searchParams.set('order_by', 'ratings')
      url.searchParams.set('order_direction', 'desc')

      const response = await fetch(url.toString(), {
        headers: {
          'Api-Key': this.apiKey,
          'User-Agent': 'SeekAll v0.4',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = (await response.json()) as {
        data?: Array<{
          id: string
          attributes: {
            language: string
            ratings: number
            release: string
            upload_date: string
            files?: Array<{ file_id: number; file_name: string }>
          }
        }>
      }

      if (!data.data) return []

      const results: SubtitleResult[] = []
      for (const item of data.data.slice(0, limit)) {
        const fileId = item.attributes.files?.[0]?.file_id
        if (!fileId) continue

        results.push({
          title: item.attributes.release || keyword,
          language: item.attributes.language,
          downloadUrl: `${this.apiUrl}/download?file_id=${fileId}`,
          rating: item.attributes.ratings,
          releaseName: item.attributes.release,
          uploadDate: item.attributes.upload_date,
        })
      }

      return results
    } catch (err) {
      this.logger.debug(`Subtitle search failed: ${(err as Error).message}`)
      return []
    }
  }
}
