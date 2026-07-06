import { useCallback, useState } from 'react'

// Base path for the API. In dev, Vite proxies /api to the Node server; in
// production the same Node server serves both the API and these static files.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

/** POST <params> to /api/<fn> and return the parsed JSON result. */
async function callApi<T>(fn: string, params: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params ?? {}),
  })

  const text = await res.text()
  const body = text ? JSON.parse(text) : null

  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body && (body as { error?: string }).error) ||
      `Request failed (${res.status})`
    throw new Error(message)
  }
  return body as T
}

export interface BackendHook<TParams, TResult> {
  /** Last successful result, or null before the first call. */
  data: TResult | null
  /** True while a call is in flight. */
  loading: boolean
  /** Last error, or null. */
  error: Error | null
  /** Run the call. Resolves with the result, or throws on failure. */
  trigger: (params?: TParams) => Promise<TResult>
}

/**
 * Builds a hook for a single backend function. Mirrors the shape Retool's
 * generated hooks exposed: { data, loading, error, trigger }.
 */
function makeBackendHook<TParams = Record<string, unknown>, TResult = unknown>(fn: string) {
  return function useBackendHook(): BackendHook<TParams, TResult> {
    const [data, setData] = useState<TResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const trigger = useCallback(async (params?: TParams) => {
      setLoading(true)
      setError(null)
      try {
        const result = await callApi<TResult>(fn, params)
        setData(result)
        return result
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    }, [])

    return { data, loading, error, trigger }
  }
}

// --- One hook per backend function (backend/fete/<name>.ts) ----------------

// Auth
export const useLoginUser = makeBackendHook('loginUser')

// Assets
export const useGetAssets = makeBackendHook('getAssets')
export const useSaveAsset = makeBackendHook('saveAsset')
export const useDeleteAsset = makeBackendHook('deleteAsset')

// Locations
export const useGetLocations = makeBackendHook('getLocations')
export const useSaveLocation = makeBackendHook('saveLocation')

// Fetes
export const useGetFetes = makeBackendHook('getFetes')
export const useSaveFete = makeBackendHook('saveFete')

// Withdrawals
export const useGetWithdrawals = makeBackendHook('getWithdrawals')
export const useGetFeteWithdrawals = makeBackendHook('getFeteWithdrawals')
export const useWithdrawAsset = makeBackendHook('withdrawAsset')
export const useReturnAsset = makeBackendHook('returnAsset')

// Users
export const useGetUsers = makeBackendHook('getUsers')
export const useGetUsersWithFetes = makeBackendHook('getUsersWithFetes')
export const useSaveUser = makeBackendHook('saveUser')
export const useDeleteUser = makeBackendHook('deleteUser')

// Fete volunteers
export const useGetFeteVolunteers = makeBackendHook('getFeteVolunteers')
export const useSaveFeteVolunteer = makeBackendHook('saveFeteVolunteer')
export const useDeleteFeteVolunteer = makeBackendHook('deleteFeteVolunteer')

// Fete requirements
export const useGetFeteRequirements = makeBackendHook('getFeteRequirements')
export const useSaveFeteRequirement = makeBackendHook('saveFeteRequirement')
export const useDeleteFeteRequirement = makeBackendHook('deleteFeteRequirement')
