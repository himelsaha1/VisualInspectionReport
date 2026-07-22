import { useState } from 'react'
import { Outlet, useLocation, NavLink } from 'react-router-dom'
import {
  Header,
  HeaderName,
  HeaderMenuButton,
  SideNav,
  SideNavItems,
  SideNavLink,
  Content,
  Toggle,
  Breadcrumb,
  BreadcrumbItem,
  SkipToContent,
} from '@carbon/react'
import {
  Dashboard,
  DocumentMultiple_01,
  ViewFilled,
} from '@carbon/icons-react'
import { useTheme } from '@/hooks/useTheme'
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs'
import { ROUTES } from '@/constants/routes'
import './AppShell.scss'

const NAV_ITEMS = [
  { label: 'Inspections', href: ROUTES.INSPECTIONS, icon: ViewFilled },
  { label: 'History', href: ROUTES.HISTORY, icon: DocumentMultiple_01 },
  { label: 'Dashboard', href: ROUTES.DASHBOARD, icon: Dashboard },
]

export default function AppShell() {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const breadcrumbs = useBreadcrumbs()
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(false)

  return (
    <>
      <SkipToContent href="#main-content">Skip to main content</SkipToContent>

      <Header aria-label="Maximo Visual Inspections">
        <HeaderMenuButton
          aria-label={isSideNavExpanded ? 'Close menu' : 'Open menu'}
          onClick={() => setIsSideNavExpanded(prev => !prev)}
          isActive={isSideNavExpanded}
        />
        <HeaderName prefix="IBM">Maximo Visual Inspections</HeaderName>
        <div className="mvi-header__actions">
          <Toggle
            id="theme-toggle"
            size="sm"
            labelA="Light"
            labelB="Dark"
            toggled={theme === 'g100'}
            onToggle={toggleTheme}
            aria-label="Toggle light/dark theme"
          />
        </div>
      </Header>

      <SideNav
        aria-label="Side navigation"
        expanded={isSideNavExpanded}
        onOverlayClick={() => setIsSideNavExpanded(false)}
        isRail
      >
        <SideNavItems>
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
            <SideNavLink
              key={href}
              as={NavLink}
              to={href}
              renderIcon={Icon}
              isActive={location.pathname === href || location.pathname.startsWith(href + '/')}
              onClick={() => setIsSideNavExpanded(false)}
            >
              {label}
            </SideNavLink>
          ))}
        </SideNavItems>
      </SideNav>

      <Content id="main-content" className="mvi-content">
        {/* Breadcrumb — hide on top-level routes */}
        {breadcrumbs.length > 2 && (
          <div className="mvi-breadcrumb">
            <Breadcrumb noTrailingSlash>
              {breadcrumbs.map((crumb, idx) => (
                <BreadcrumbItem
                  key={idx}
                  href={crumb.href}
                  isCurrentPage={!crumb.href}
                >
                  {crumb.label}
                </BreadcrumbItem>
              ))}
            </Breadcrumb>
          </div>
        )}
        <Outlet />
      </Content>
    </>
  )
}
