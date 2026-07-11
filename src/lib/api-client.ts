/**
 * iSecurify — Typed API client
 * Wraps fetch with JSON parsing and error handling.
 * All API responses follow: { data: T } | { error: string }
 */
import type { ApiResponse } from '@/types'

class ApiClient {
  private baseUrl = '/api'

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        headers: { 'Content-Type': 'application/json', ...init?.headers },
        ...init,
      })
    } catch (fetchErr) {
      // Network error, DNS failure, request aborted, etc.
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Network error'
      throw new Error(`Network request failed: ${msg}`)
    }

    // Try to parse JSON body — handle empty or non-JSON responses gracefully
    let json: ApiResponse<T>
    try {
      json = await res.json()
    } catch {
      // Body is empty, not JSON, or truncated
      throw new Error(
        `Server returned ${res.status} ${res.statusText} with an invalid or empty response body`,
      )
    }

    // Check for application-level error (our standard { error: string } envelope)
    if (json.error) throw new Error(json.error)

    // Check HTTP status for any other non-2xx responses
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`)

    return json.data as T
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path)
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }
}

export const api = new ApiClient()