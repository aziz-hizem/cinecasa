import { useEffect, useRef, useState } from 'react'

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string
  fallback?: React.ReactNode
}

/**
 * Image with fade-in once loaded. Renders fallback while no src.
 */
export default function LazyImage({
  src,
  fallback,
  className = '',
  alt = '',
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
    const img = imgRef.current
    if (img?.complete) {
      if (img.naturalWidth > 0) setLoaded(true)
      else setFailed(true)
    }
  }, [src])

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-bg-card text-text-muted ${className}`}>
        {fallback}
      </div>
    )
  }

  return (
    <img
      {...rest}
      ref={imgRef}
      src={src}
      alt={alt}
      onLoad={() => setLoaded(true)}
      onError={() => {
        setLoaded(true)
        setFailed(true)
      }}
      className={`img-fade ${loaded ? 'loaded' : ''} ${className}`}
      loading="lazy"
    />
  )
}
