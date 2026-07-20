import { createContext } from 'react'

export type CarbonTheme = 'white' | 'g10' | 'g90' | 'g100'

export interface ThemeContextValue {
  theme: CarbonTheme
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'white',
  toggleTheme: () => {},
})
