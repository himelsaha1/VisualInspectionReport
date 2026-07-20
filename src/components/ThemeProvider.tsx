import { useEffect, useState } from 'react'
import { Theme } from '@carbon/react'
import { ThemeContext, type CarbonTheme } from '@/contexts/ThemeContext'

const STORAGE_KEY = 'mvi-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<CarbonTheme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return (stored as CarbonTheme) ?? 'white'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme)
    document.documentElement.setAttribute('data-carbon-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'white' ? 'g100' : 'white'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Theme theme={theme}>{children}</Theme>
    </ThemeContext.Provider>
  )
}
