import { useCallback, useState } from 'react'

// Base path for the API. In dev, Vite proxies /api to the Node server; in
// production the same Node server serves both the API and these static files.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

function getUserHeaderValue(): string | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem('mdd-current-user')
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as { id?: unknown; name?: unknown; email?: unknown; role?: unknown }
    if (
      typeof parsed.id === 'number' &&
      typeof parsed.name === 'string' &&
      typeof parsed.email === 'string' &&
      typeof parsed.role === 'string'
    ) {
      return JSON.stringify({
        id: parsed.id,
        name: parsed.name,
        email: parsed.email,
        role: parsed.role,
      })
    }
  } catch {
    return null
  }

  return null
}

/** POST <params> to /api/<fn> and return the parsed JSON result. */
async function callApi<T>(fn: string, params: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const userHeader = getUserHeaderValue()
  if (userHeader) {
    headers['x-app-user'] = userHeader
  }

  const res = await fetch(`${API_BASE}/${fn}`, {
    method: 'POST',
    headers,
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

// Fete locations (event venues in store_locations where location_type='Fetes')
export const useGetFeteLocations = makeBackendHook('getFeteLocations')
export const useSaveFeteLocation = makeBackendHook('saveFeteLocation')
export const useDeleteFeteLocation = makeBackendHook('deleteFeteLocation')

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

// Fete requirements
export const useGetFeteRequirements = makeBackendHook('getFeteRequirements')
export const useSaveFeteRequirement = makeBackendHook('saveFeteRequirement')
export const useDeleteFeteRequirement = makeBackendHook('deleteFeteRequirement')

// Database backups
export const useListBackups = makeBackendHook('listBackups')
export const useCreateBackup = makeBackendHook('createBackup')
export const useDeleteBackup = makeBackendHook('deleteBackup')

// Migration and health
export const useGetMigrationStatus = makeBackendHook('getMigrationStatus')
export const useMigrateLegacyVolunteerNotes = makeBackendHook('migrateLegacyVolunteerNotes')
