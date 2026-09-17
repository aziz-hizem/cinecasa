/**
 * Fixed, full-viewport background image for a special's themed pages.
 * Sits behind all page content with a heavy scrim so text/cards stay readable.
 */
export default function SpecialBackdrop({ src }: { src: string }) {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden="true">
      <img src={src} alt="" decoding="async" className="w-full h-full object-cover" />
      {/* Vertical scrim — keeps the top readable and fades into the app bg */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/85 to-bg" />
      {/* Side vignette for a bit of depth */}
      <div className="absolute inset-0 bg-gradient-to-r from-bg/60 via-transparent to-bg/60" />
    </div>
  )
}
