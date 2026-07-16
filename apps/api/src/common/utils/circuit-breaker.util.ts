/**
 * 熔断器（Circuit Breaker）
 *
 * 状态机：
 *   closed（正常）-> 连续失败 N 次 -> open（熔断，拒绝请求）
 *   open -> 等待 cooldown 秒 -> half-open（放行 1 次试探）
 *   half-open -> 成功 -> closed
 *   half-open -> 失败 -> open（重置 cooldown）
 *
 * 配置：
 *   CIRCUIT_BREAKER_FAILURE_THRESHOLD=5  连续失败阈值
 *   CIRCUIT_BREAKER_COOLDOWN=30          熔断冷却秒数
 *   CIRCUIT_BREAKER_HALF_OPEN_MAX=1      半开状态最大试探次数
 */

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerOptions {
  failureThreshold?: number
  cooldownMs?: number
  halfOpenMax?: number
}

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private lastFailureAt = 0
  private halfOpenAttempts = 0

  private readonly failureThreshold: number
  private readonly cooldownMs: number
  private readonly halfOpenMax: number

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold =
      options.failureThreshold ?? Number(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || 5)
    this.cooldownMs =
      options.cooldownMs ?? Number(process.env.CIRCUIT_BREAKER_COOLDOWN || 30) * 1000
    this.halfOpenMax = options.halfOpenMax ?? 1
  }

  /**
   * 是否允许请求通过
   * - closed: 允许
   * - open: 检查 cooldown 是否到期，到期转 half-open
   * - half-open: 限制试探次数
   */
  allow(): boolean {
    const now = Date.now()

    if (this.state === 'closed') {
      return true
    }

    if (this.state === 'open') {
      if (now - this.lastFailureAt >= this.cooldownMs) {
        // 冷却到期，转半开
        this.state = 'half-open'
        this.halfOpenAttempts = 0
        return true
      }
      return false
    }

    // half-open
    if (this.halfOpenAttempts < this.halfOpenMax) {
      this.halfOpenAttempts++
      return true
    }
    return false
  }

  /**
   * 记录成功
   * - half-open -> closed（恢复）
   * - closed: 重置失败计数
   */
  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed'
      this.failureCount = 0
      this.halfOpenAttempts = 0
    } else if (this.state === 'closed') {
      this.failureCount = 0
    }
  }

  /**
   * 记录失败
   * - closed: 累加失败，超阈值转 open
   * - half-open: 立即转 open
   * - open: 更新 lastFailureAt（延长冷却）
   */
  recordFailure(): void {
    this.lastFailureAt = Date.now()

    if (this.state === 'half-open') {
      // 半开试探失败，重新熔断
      this.state = 'open'
      this.failureCount = this.failureThreshold
      return
    }

    if (this.state === 'closed') {
      this.failureCount++
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'open'
      }
    }
  }

  getState(): CircuitState {
    return this.state
  }

  isOpen(): boolean {
    return this.state === 'open'
  }

  /**
   * 手动重置（管理员恢复时用）
   */
  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.halfOpenAttempts = 0
    this.lastFailureAt = 0
  }

  getStats(): {
    name: string
    state: CircuitState
    failureCount: number
    failureThreshold: number
    lastFailureAt: number | null
  } {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureAt: this.lastFailureAt || null,
    }
  }
}
