import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import TopNav from './components/nav/TopNav'
import Home from './routes/Home'
import Movies from './routes/Movies'
import TVShows from './routes/TVShows'
import Specials from './routes/Specials'
import SpecialHub from './routes/SpecialHub'
import Search from './routes/Search'
import Settings from './routes/Settings'
import MovieDetail from './routes/MovieDetail'
import ShowDetail from './routes/ShowDetail'

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="h-full"
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const location = useLocation()

  return (
    <div className="flex h-full flex-col bg-bg text-text-primary">
      {/* Custom titlebar drag region (window has titleBarStyle: hidden) */}
      <div className="titlebar-drag h-9 flex-shrink-0" />

      <TopNav />

      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <PageWrapper>
                  <Home />
                </PageWrapper>
              }
            />
            <Route
              path="/movies"
              element={
                <PageWrapper>
                  <Movies />
                </PageWrapper>
              }
            />
            <Route
              path="/tv"
              element={
                <PageWrapper>
                  <TVShows />
                </PageWrapper>
              }
            />
            <Route
              path="/specials"
              element={
                <PageWrapper>
                  <Specials />
                </PageWrapper>
              }
            />
            <Route
              path="/specials/:kind"
              element={
                <PageWrapper>
                  <SpecialHub />
                </PageWrapper>
              }
            />
            {/* Marvel used to have its own top-level tab — keep the URL working. */}
            <Route path="/marvel" element={<Navigate to="/specials/marvel" replace />} />
            <Route
              path="/search"
              element={
                <PageWrapper>
                  <Search />
                </PageWrapper>
              }
            />
            <Route
              path="/settings"
              element={
                <PageWrapper>
                  <Settings />
                </PageWrapper>
              }
            />
            <Route
              path="/movie/:id"
              element={
                <PageWrapper>
                  <MovieDetail />
                </PageWrapper>
              }
            />
            <Route
              path="/show/:id"
              element={
                <PageWrapper>
                  <ShowDetail />
                </PageWrapper>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  )
}
