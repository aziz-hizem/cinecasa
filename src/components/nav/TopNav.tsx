import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, Film, Tv, Search, Settings as SettingsIcon, Sparkles, SkipForward } from 'lucide-react'
import marvelLogo from '../../../assets/Marvel_Logo.svg.webp'
import cinecasaLogo from '../../../assets/icons/cinecasa.svg'

/** Marvel keeps a dedicated header tab even though it also lives under Specials. */
const MARVEL_PATH = '/specials/marvel'

const navItems = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/movies', label: 'Cinema', icon: Film },
  { to: '/tv', label: 'TV Shows', icon: Tv },
  { to: '/specials', label: 'Specials', icon: Sparkles, special: true },
  { to: '/search', label: 'Search', icon: Search },
]

export default function TopNav() {
  const [autoPlay, setAutoPlay] = useState(true)
  const location = useLocation()
  // Marvel has its own tab, so the Specials tab shouldn't also light up there.
  const onMarvel = location.pathname === MARVEL_PATH

  // Read initial value from main process on mount.
  useEffect(() => {
    void window.api.playback.getAutoPlay().then((res) => {
      if (res.ok && res.data !== undefined) setAutoPlay(res.data)
    })
  }, [])

  async function toggleAutoPlay() {
    const next = !autoPlay
    setAutoPlay(next)
    await window.api.playback.setAutoPlay(next)
  }

  return (
    <nav className="titlebar-no-drag flex items-center gap-2 border-b border-border-subtle bg-bg/80 backdrop-blur-md px-6 h-14 flex-shrink-0">
      <div className="flex items-center gap-2 mr-6 select-none">
        <img src={cinecasaLogo} alt="" className="w-8 h-8 rounded-lg" draggable={false} />
        <span className="text-lg font-semibold tracking-tight">Cinecasa</span>
      </div>

      <div className="flex items-center gap-1">
        {navItems.map(({ to, label, icon: Icon, end, special }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => {
              const active = special ? isActive && !onMarvel : isActive
              return `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                special
                  ? active
                    ? 'text-amber-300 bg-amber-500/10'
                    : 'text-amber-200/80 hover:text-amber-200 hover:bg-amber-500/10'
                  : active
                    ? 'text-text-primary bg-bg-card'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-card/60'
              }`
            }}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* Marvel — kept as a dedicated tab, jumps straight to its Specials hub. */}
        <NavLink
          to={MARVEL_PATH}
          className={({ isActive }) =>
            `group flex items-center px-3 py-1.5 rounded-md transition-all duration-200 ${
              isActive ? 'bg-red-600/15 ring-1 ring-inset ring-red-600/50' : 'hover:bg-red-600/10'
            }`
          }
          title="Marvel"
        >
          <img
            src={marvelLogo}
            alt="Marvel"
            className="h-4 w-auto object-contain opacity-90 group-hover:opacity-100 drop-shadow-[0_0_5px_rgba(237,29,36,0.75)] group-hover:drop-shadow-[0_0_9px_rgba(237,29,36,0.95)] transition-all duration-200"
          />
        </NavLink>
      </div>

      {/* Auto-play next episode toggle — checkbox, track, and knob are all flat siblings
          so peer-checked can actually reach the knob (it can't reach nested descendants). */}
      <div className="ml-auto flex items-center gap-3 mr-2">
        <label
          className="flex items-center gap-2 cursor-pointer select-none group"
          title={autoPlay ? 'Auto-play next episode: ON' : 'Auto-play next episode: OFF'}
        >
          <SkipForward
            className={`w-3.5 h-3.5 transition-colors ${
              autoPlay ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary'
            }`}
          />
          <span
            className={`text-xs font-medium transition-colors hidden lg:block ${
              autoPlay ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary'
            }`}
          >
            Auto-play
          </span>
          <span className="relative inline-block w-11 h-6">
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={toggleAutoPlay}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-bg-card ring-1 ring-inset ring-border-subtle peer-checked:bg-accent peer-checked:ring-0 transition-colors duration-300 pointer-events-none" />
            <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 peer-checked:translate-x-5 pointer-events-none" />
          </span>
        </label>
      </div>

      <NavLink
        to="/settings"
        className={({ isActive }) =>
          `flex items-center justify-center w-9 h-9 rounded-md transition-colors ${
            isActive
              ? 'text-text-primary bg-bg-card'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-card/60'
          }`
        }
        title="Settings"
      >
        <SettingsIcon className="w-4 h-4" />
      </NavLink>
    </nav>
  )
}
