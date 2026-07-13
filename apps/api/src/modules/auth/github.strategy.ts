import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-github2'
import { ConfigService } from '@nestjs/config'

export interface GithubProfile {
  id: string
  username: string
  displayName?: string
  emails?: Array<{ value: string; verified: boolean }>
  photos?: Array<{ value: string }>
}

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID', ''),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET', ''),
      callbackURL: configService.get<string>(
        'GITHUB_CALLBACK_URL',
        'http://localhost:3000/api/v1/auth/github/callback',
      ),
      scope: ['user:email'],
    })
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: unknown,
  ): Promise<GithubProfile> {
    const p = profile as Record<string, unknown>
    const id = String(p.id || '')
    if (!id) {
      throw new UnauthorizedException('GitHub profile invalid')
    }

    const emails = (p.emails as Array<{ value: string; verified: boolean }>) || []
    const primaryEmail = emails.find((e) => e.verified)?.value || emails[0]?.value

    return {
      id,
      username: String(p.username || ''),
      displayName: p.displayName as string | undefined,
      emails: primaryEmail ? [{ value: primaryEmail, verified: true }] : undefined,
      photos: (p.photos as Array<{ value: string }>) || undefined,
    }
  }
}
