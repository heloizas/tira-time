class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests: number = 5, windowMs: number = 60000) { // 5 requests per minute
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(identifier) || []

    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs)

    if (validRequests.length >= this.maxRequests) {
      return false
    }

    // Add current request
    validRequests.push(now)
    this.requests.set(identifier, validRequests)

    return true
  }

  reset(identifier: string): void {
    this.requests.delete(identifier)
  }
}

export const authRateLimiter = new RateLimiter(5, 60000) // 5 requests per minute