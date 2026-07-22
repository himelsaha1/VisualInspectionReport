import { useNavigate } from 'react-router-dom'
import {
  Button,
  Heading,
  Tag,
  Tile,
  Toggle,
  Accordion,
  AccordionItem,
} from '@carbon/react'
import './SettingsPage.scss'
import {
  User,
  Settings,
  Link,
  CheckmarkFilled,
} from '@carbon/icons-react'
import { useTheme } from '@/hooks/useTheme'
import './SettingsPage.scss'

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const ENV = {
    label:    'MAS Dev — metadev',
    url:      'masdev-mcp.manage.metadev.apps.mngai-1086.cp.fyre.ibm.com',
    status:   'connected',
    version:  'Maximo Application Suite 8.11',
  }

  return (
    <div className="settings-page">
      <Heading>Settings</Heading>
      <p className="settings-page__sub">Profile, appearance, and connected Maximo environment.</p>

      {/* ── Profile ── */}
      <section className="settings-page__section">
        <div className="settings-page__section-header">
          <User size={16} />
          <span>Profile</span>
        </div>
        <Tile className="settings-page__tile">
          <div className="settings-page__row">
            <span className="settings-page__label">Name</span>
            <span className="settings-page__value">Field Technician</span>
          </div>
          <div className="settings-page__row">
            <span className="settings-page__label">User ID</span>
            <span className="settings-page__mono">maxadmin</span>
          </div>
          <div className="settings-page__row">
            <span className="settings-page__label">Role</span>
            <Tag type="blue" size="sm">Technician</Tag>
          </div>
        </Tile>
      </section>

      {/* ── Appearance ── */}
      <section className="settings-page__section">
        <div className="settings-page__section-header">
          <Settings size={16} />
          <span>Appearance</span>
        </div>
        <Tile className="settings-page__tile">
          <div className="settings-page__row settings-page__row--spread">
            <div>
              <p className="settings-page__field-label">Theme</p>
              <p className="settings-page__secondary">
                {theme === 'g100' ? 'Dark (g100)' : 'Light (g10)'}
              </p>
            </div>
            <Toggle
              id="settings-theme-toggle"
              size="sm"
              labelA="Light"
              labelB="Dark"
              toggled={theme === 'g100'}
              onToggle={toggleTheme}
              aria-label="Toggle light/dark theme"
              hideLabel
            />
          </div>
          <div className="settings-page__row settings-page__row--spread">
            <div>
              <p className="settings-page__field-label">Font</p>
              <p className="settings-page__secondary">IBM Plex Sans · IBM Plex Mono for IDs</p>
            </div>
          </div>
        </Tile>
      </section>

      {/* ── Connected environment ── */}
      <section className="settings-page__section">
        <div className="settings-page__section-header">
          <Link size={16} />
          <span>Connected Maximo environment</span>
        </div>
        <Tile className="settings-page__tile">
          <div className="settings-page__row settings-page__row--spread">
            <div>
              <p className="settings-page__field-label">{ENV.label}</p>
              <p className="settings-page__mono">{ENV.url}</p>
            </div>
            <Tag type="green" size="sm">
              <CheckmarkFilled size={12} style={{ marginInlineEnd: '0.25rem' }} />
              {ENV.status}
            </Tag>
          </div>
          <div className="settings-page__row">
            <span className="settings-page__label">Version</span>
            <span className="settings-page__value">{ENV.version}</span>
          </div>
          <div className="settings-page__row">
            <span className="settings-page__label">MCP endpoint</span>
            <span className="settings-page__mono settings-page__mono--small">
              https://{ENV.url}/mcp
            </span>
          </div>
        </Tile>
      </section>

      {/* ── Advanced ── */}
      <section className="settings-page__section">
        <Accordion>
          <AccordionItem title="Advanced / Developer">
            <div className="settings-page__advanced">
              <div className="settings-page__row">
                <span className="settings-page__label">API key</span>
                <span className="settings-page__mono settings-page__mono--small">
                  8453••••••••••••••••••••••••••••••••••
                </span>
              </div>
              <div className="settings-page__row">
                <span className="settings-page__label">Mock server</span>
                <span className="settings-page__mono settings-page__mono--small">
                  http://localhost:8001
                </span>
              </div>
              <Button
                kind="danger--ghost"
                size="sm"
                style={{ marginBlockStart: '1rem' }}
                onClick={() => {
                  localStorage.clear()
                  navigate('/')
                }}
              >
                Clear all local data
              </Button>
            </div>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  )
}
