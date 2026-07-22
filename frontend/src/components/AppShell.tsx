import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  Header,
  HeaderName,
  HeaderMenuButton,
  SideNav,
  SideNavItems,
  SideNavLink,
  Content,
  SkipToContent,
} from '@carbon/react'
import {
  Add,
  Time,
  Dashboard,
  Settings,
} from '@carbon/icons-react'
import { useTheme } from '@/hooks/useTheme'
import { ROUTES } from '@/constants/routes'
import GlobalChat from '@/components/GlobalChat'
import './AppShell.scss'

const NAV_ITEMS = [
  { label: 'New inspection', href: ROUTES.HOME,       icon: Add       },
  { label: 'History',        href: ROUTES.INSPECTIONS, icon: Time      },
  { label: 'Dashboard',      href: ROUTES.DASHBOARD,  icon: Dashboard },
  { label: 'Settings',       href: ROUTES.SETTINGS,   icon: Settings  },
]

export default function AppShell() {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [sideNavOpen, setSideNavOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/'
      ? location.pathname === '/'
      : location.pathname === href || location.pathname.startsWith(href + '/')

  return (
    <>
      <SkipToContent href="#main-content">Skip to main content</SkipToContent>

      <Header aria-label="IBM Maximo Visual Inspections">
        <HeaderMenuButton
          aria-label={sideNavOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setSideNavOpen(v => !v)}
          isActive={sideNavOpen}
        />
        <HeaderName prefix="IBM">Maximo Visual Inspections</HeaderName>

        {/* Theme toggle in header */}
        <div className="mvi-header__actions">
          <button
            type="button"
            className="mvi-theme-btn"
            aria-label={`Switch to ${theme === 'g100' ? 'light' : 'dark'} theme`}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'g100' ? 'light' : 'dark'} theme`}
          >
            {theme === 'g100' ? '☀' : '☾'}
          </button>
        </div>
      </Header>

      {/* Desktop / tablet side nav */}
      <SideNav
        aria-label="Side navigation"
        expanded={sideNavOpen}
        onOverlayClick={() => setSideNavOpen(false)}
        isRail
      >
        <SideNavItems>
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
            <SideNavLink
              key={href}
              as={NavLink}
              to={href}
              renderIcon={Icon}
              isActive={isActive(href)}
              onClick={() => setSideNavOpen(false)}
            >
              {label}
            </SideNavLink>
          ))}
        </SideNavItems>
      </SideNav>

      <Content id="main-content" className="mvi-content">
        <Outlet />
      </Content>

      {/* Mobile bottom tab bar — shown only on small screens via CSS */}
      <nav className="mvi-bottom-tabs" aria-label="Main navigation">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            end={href === '/'}
            className={({ isActive: a }) =>
              `mvi-bottom-tabs__item${a ? ' mvi-bottom-tabs__item--active' : ''}`
            }
            aria-label={label}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Global AI assistant — present on every screen */}
      <GlobalChat />
    </>
  )
}
