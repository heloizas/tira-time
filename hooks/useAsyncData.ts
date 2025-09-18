import { useEffect, useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'

interface UseAsyncDataOptions<T> {
  fetchFn: () => Promise<T>
  deps?: React.DependencyList
  timeout?: number
  enabled?: boolean
  onError?: (error: Error) => void
  onSuccess?: (data: T) => void
}

interface UseAsyncDataResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  timeoutOccurred: boolean
  retry: () => void
  reset: () => void
}

export function useAsyncData<T>({
  fetchFn,
  deps = [],
  timeout = 8000,
  enabled = true,
  onError,
  onSuccess
}: UseAsyncDataOptions<T>): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [timeoutOccurred, setTimeoutOccurred] = useState(false)

  const controllerRef = useRef<AbortController | null>(null)
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setTimeoutOccurred(false)
  }, [])

  const execute = useCallback(async () => {
    if (!enabled || !isMountedRef.current) return

    // Cancelar requisição anterior se existir
    if (controllerRef.current) {
      controllerRef.current.abort()
    }

    controllerRef.current = new AbortController()
    let timeoutTriggered = false

    setLoading(true)
    setError(null)
    setTimeoutOccurred(false)

    // Timeout de segurança
    timeoutIdRef.current = setTimeout(() => {
      if (!isMountedRef.current) return

      timeoutTriggered = true
      controllerRef.current?.abort()
      setTimeoutOccurred(true)
      setLoading(false)

      const timeoutError = new Error('Request timeout')
      setError(timeoutError)

      toast.error('Timeout no carregamento. Verifique sua conexão.')

      onError?.(timeoutError)
    }, timeout)

    try {
      const result = await fetchFn()

      if (!timeoutTriggered && isMountedRef.current) {
        setData(result)
        setTimeoutOccurred(false)
        if (result !== null) {
          onSuccess?.(result)
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      if (!timeoutTriggered && error.name !== 'AbortError' && isMountedRef.current) {
        setError(error)

        // Mensagens de erro mais específicas
        if (error.message?.includes('JWT')) {
          toast.error('Sessão expirada. Recarregue a página.')
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
          toast.error('Erro de conexão. Verifique sua internet.')
          setTimeoutOccurred(true)
        } else if (!error.message?.includes('timeout')) {
          toast.error('Erro ao carregar dados.')
        }

        onError?.(error)
      }
    } finally {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }

      if (!timeoutTriggered && isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [fetchFn, enabled, timeout, onError, onSuccess])

  const retry = useCallback(() => {
    reset()
    execute()
  }, [reset, execute])

  useEffect(() => {
    isMountedRef.current = true
    execute()

    return () => {
      isMountedRef.current = false

      if (controllerRef.current) {
        controllerRef.current.abort()
      }

      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }
    }
  }, deps)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return {
    data,
    loading,
    error,
    timeoutOccurred,
    retry,
    reset
  }
}