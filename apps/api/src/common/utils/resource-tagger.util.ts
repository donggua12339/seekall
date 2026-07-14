/**
 * 资源标签自动分类器
 *
 * 基于标题关键词规则匹配，自动给资源打标签。
 * 无需 AI API，纯本地规则，速度快、零成本。
 */

export type ResourceTag =
  | 'movie'
  | 'tv'
  | 'anime'
  | 'course'
  | 'ebook'
  | 'software'
  | 'game'
  | 'music'
  | 'document'
  | 'other'

export const TAG_LABELS: Record<ResourceTag, string> = {
  movie: '电影',
  tv: '剧集',
  anime: '动漫',
  course: '课程',
  ebook: '电子书',
  software: '软件',
  game: '游戏',
  music: '音乐',
  document: '文档',
  other: '其他',
}

interface Rule {
  tag: ResourceTag
  patterns: RegExp[]
}

const RULES: Rule[] = [
  {
    tag: 'movie',
    patterns: [
      /电影/i,
      /\b(1080p|2160p|4k|hdr|web-?dl|blu-?ray|bd|remux)\b/i,
      /\b(202[0-9]|201[0-9])\b.*\b(国语|粤语|英语|中字|中英|双语|双字)\b/i,
      /\bdvdrip\b/i,
      /\bts版?\b/i,
      /\b枪版\b/i,
    ],
  },
  {
    tag: 'tv',
    patterns: [
      /剧集|连续剧|电视剧/i,
      /\bS\d{1,2}E\d{1,3}\b/i,
      /第\d+集|全\d+集|更新至\d+集/i,
      /\bSEASON\b/i,
      /完结|全季|S0\d/i,
    ],
  },
  {
    tag: 'anime',
    patterns: [
      /动漫|动画|番剧|日漫|国漫/i,
      /\[(ANi|LoliHouse|SweetSub|VARYG|ANIME)\]/i,
      /\b(720p|1080p).*\b(HEVC|AVC|AAC)\b.*\b(简繁|内封|内嵌)\b/i,
      /新番|旧番/i,
    ],
  },
  {
    tag: 'course',
    patterns: [
      /课程|教程|教学|视频课/i,
      /\b(慕课|极客|拉勾|黑马|尚硅谷|千锋)\b/i,
      /\b(Java|Python|Go|Rust|前端|后端|全栈|算法|数据结构)\b.*\b(教程|课程|实战)\b/i,
      /\b(Udemy|Coursera|网易云课堂|腾讯课堂)\b/i,
      /第\d+章|第\d+节|第\d+讲/i,
    ],
  },
  {
    tag: 'ebook',
    patterns: [
      /电子书|PDF|EPUB|MOBI|AZW3/i,
      /\b(Kindle|京东读书|微信读书)\b/i,
      /\b\d+册\b/i,
      /合集|套装|全集/i,
    ],
  },
  {
    tag: 'software',
    patterns: [
      /软件|工具|应用|APP/i,
      /\b(Windows|Mac|Linux|Android|iOS)\b.*\b(版|安装包|绿色|破解|注册机)\b/i,
      /\b(Crack|Patch|Keygen|破解版|绿色版|便携版)\b/i,
      /\b(v\d+\.\d+)\b/i,
      /\b(Photoshop|Office|AutoCAD|MATLAB|IDEA|VSCode)\b/i,
    ],
  },
  {
    tag: 'game',
    patterns: [
      /游戏|Game/i,
      /\b(PC|Steam|Epic|Switch|PS[45]|Xbox)\b.*\b(版|游戏)\b/i,
      /\b(整合版|未加密|CODEX|RELOADED|SKIDROW|CPY)\b/i,
      /\b(角色扮演|RPG|动作|射击|策略|模拟|独立)\b.*\b游戏\b/i,
    ],
  },
  {
    tag: 'music',
    patterns: [
      /音乐|歌曲|专辑|单曲/i,
      /\b(FLAC|APE|WAV|DSD|Hi-?Res)\b/i,
      /\b(mp3|320kbps|CDRip)\b/i,
      /\b(OST|BGM|原声)\b/i,
    ],
  },
  {
    tag: 'document',
    patterns: [
      /文档|资料|报告|论文|PPT/i,
      /\b(Word|Excel|PPT|PDF)\b/i,
      /\b(考研|公务员|四六级|雅思|托福)\b/i,
      /真题|试题|试卷/i,
    ],
  },
]

/**
 * 自动分类资源
 * @param title 资源标题
 * @returns 标签数组（可能多个）
 */
export function classifyResource(title: string): ResourceTag[] {
  const tags: ResourceTag[] = []
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(title))) {
      tags.push(rule.tag)
    }
  }
  return tags.length > 0 ? tags : ['other']
}

/**
 * 获取主标签（第一个匹配的）
 */
export function getPrimaryTag(title: string): ResourceTag {
  const tags = classifyResource(title)
  return tags[0]
}
