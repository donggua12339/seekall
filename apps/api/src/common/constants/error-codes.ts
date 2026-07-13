// 觅源 SeekAll - 错误码体系
// 5 位数字编码

export enum ErrorCode {
  // 成功
  SUCCESS = 0,

  // 1xxxx - 通用错误
  PARAM_ERROR = 10001,
  UNAUTHORIZED = 10002,
  FORBIDDEN = 10003,
  NOT_FOUND = 10004,
  METHOD_NOT_ALLOWED = 10005,
  RATE_LIMIT_EXCEEDED = 10006,
  INTERNAL_ERROR = 10000,

  // 2xxxx - 认证错误
  INVITE_CODE_INVALID = 20001,
  INVITE_CODE_USED = 20002,
  INVITE_CODE_EXPIRED = 20003,
  USERNAME_EXISTS = 20004,
  EMAIL_EXISTS = 20005,
  PASSWORD_TOO_WEAK = 20006,
  PASSWORD_INCORRECT = 20007,
  TOKEN_EXPIRED = 20008,
  TOKEN_INVALID = 20009,
  EMAIL_NOT_VERIFIED = 20010,
  EMAIL_VERIFY_TOKEN_INVALID = 20011,
  PASSWORD_RESET_TOKEN_INVALID = 20012,
  ACCOUNT_BANNED = 20013,
  ACCOUNT_DELETED = 20014,
  MEMBERSHIP_CODE_INVALID = 20015,
  MEMBERSHIP_CODE_USED = 20016,
  MEMBERSHIP_CODE_EXPIRED = 20017,

  // 3xxxx - 资源错误
  RESOURCE_NOT_FOUND = 30001,
  RESOURCE_TAKEDOWN = 30002,
  FAVORITE_EXISTS = 30003,

  // 4xxxx - 搜索错误
  SEARCH_TIMEOUT = 40001,
  SEARCH_NO_PROVIDER = 40002,
  SEARCH_QUERY_EMPTY = 40003,
  SEARCH_QUERY_TOO_LONG = 40004,
  SEARCH_BLOCKED_KEYWORD = 40005,

  // 5xxxx - 系统错误
  DB_ERROR = 50001,
  REDIS_ERROR = 50002,
  MAIL_SEND_FAILED = 50003,
  EXTERNAL_API_ERROR = 50004,
}

export const errorMessageMap: Record<number, string> = {
  [ErrorCode.SUCCESS]: 'ok',
  [ErrorCode.PARAM_ERROR]: '参数错误',
  [ErrorCode.UNAUTHORIZED]: '未授权',
  [ErrorCode.FORBIDDEN]: '禁止访问',
  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.METHOD_NOT_ALLOWED]: '方法不允许',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '请求过于频繁',
  [ErrorCode.INTERNAL_ERROR]: '内部错误',
  [ErrorCode.INVITE_CODE_INVALID]: '邀请码无效',
  [ErrorCode.INVITE_CODE_USED]: '邀请码已被使用',
  [ErrorCode.INVITE_CODE_EXPIRED]: '邀请码已过期',
  [ErrorCode.USERNAME_EXISTS]: '用户名已存在',
  [ErrorCode.EMAIL_EXISTS]: '邮箱已存在',
  [ErrorCode.PASSWORD_TOO_WEAK]: '密码强度不足',
  [ErrorCode.PASSWORD_INCORRECT]: '密码错误',
  [ErrorCode.TOKEN_EXPIRED]: 'Token 已过期',
  [ErrorCode.TOKEN_INVALID]: 'Token 无效',
  [ErrorCode.EMAIL_NOT_VERIFIED]: '邮箱未验证',
  [ErrorCode.EMAIL_VERIFY_TOKEN_INVALID]: '邮箱验证链接无效或已过期',
  [ErrorCode.PASSWORD_RESET_TOKEN_INVALID]: '密码重置链接无效或已过期',
  [ErrorCode.ACCOUNT_BANNED]: '账号已被封禁',
  [ErrorCode.ACCOUNT_DELETED]: '账号已注销',
  [ErrorCode.MEMBERSHIP_CODE_INVALID]: '会员激活码无效',
  [ErrorCode.MEMBERSHIP_CODE_USED]: '会员激活码已被使用',
  [ErrorCode.MEMBERSHIP_CODE_EXPIRED]: '会员激活码已过期',
  [ErrorCode.RESOURCE_NOT_FOUND]: '资源不存在',
  [ErrorCode.RESOURCE_TAKEDOWN]: '资源已下架',
  [ErrorCode.FAVORITE_EXISTS]: '已收藏过该资源',
  [ErrorCode.SEARCH_TIMEOUT]: '搜索超时',
  [ErrorCode.SEARCH_NO_PROVIDER]: '无可用数据源',
  [ErrorCode.SEARCH_QUERY_EMPTY]: '搜索关键词不能为空',
  [ErrorCode.SEARCH_QUERY_TOO_LONG]: '搜索关键词过长',
  [ErrorCode.SEARCH_BLOCKED_KEYWORD]: '搜索关键词已被屏蔽',
  [ErrorCode.DB_ERROR]: '数据库错误',
  [ErrorCode.REDIS_ERROR]: '缓存错误',
  [ErrorCode.MAIL_SEND_FAILED]: '邮件发送失败',
  [ErrorCode.EXTERNAL_API_ERROR]: '外部 API 调用失败',
}

export function getErrorMessage(code: number): string {
  return errorMessageMap[code] || '未知错误'
}
