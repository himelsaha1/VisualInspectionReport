import { useEffect, useState } from 'react'
import type { Asset } from '@/types'
import { getAssets } from '@/services/maximo.service'

interface UseAssetsResult {
  assets: Asset[]
  loading: boolean
  error: string | null
}

export function useAssets(): UseAssetsResult {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getAssets()
      .then(data => {
        if (!cancelled) setAssets(data)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load assets')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { assets, loading, error }
}
