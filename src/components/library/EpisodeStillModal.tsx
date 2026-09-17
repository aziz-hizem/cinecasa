import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, Image as ImageIcon } from 'lucide-react'
import type { Episode } from '@shared/types'
import LazyImage from './LazyImage'
import { imgSrc } from '@/lib/format'

interface EpisodeStillModalProps {
  isOpen: boolean
  episode: Episode
  onClose: () => void
  onUpdated: () => void
}

export default function EpisodeStillModal({
  isOpen,
  episode,
  onClose,
  onUpdated,
}: EpisodeStillModalProps) {
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')
  const [statusMsg, setStatusMsg] = useState('')

  async function handleUpload() {
    const res = await window.api.metadata.uploadEpisodeImage(episode.id)
    if (res.ok && res.data) {
      setStatus('ok')
      setStatusMsg('Still updated successfully')
      setUploading(false)
      onUpdated()
      setTimeout(onClose, 1500)
    } else {
      setStatus('err')
      setStatusMsg(res.error ?? 'Failed to upload still')
      setUploading(false)
    }
  }

  const still = imgSrc(episode.stillPath)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-bg-card border border-border-subtle rounded-card p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                S{String(episode.seasonNumber).padStart(2, '0')}E
                {String(episode.episodeNumber).padStart(2, '0')} — {episode.title || 'Episode'}
              </h2>
              <button
                onClick={onClose}
                className="btn-ghost !p-1.5"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current still preview */}
            {still ? (
              <div className="mb-4 rounded-card overflow-hidden bg-bg">
                <LazyImage
                  src={still}
                  alt={episode.title ?? 'Episode still'}
                  className="w-full aspect-video object-cover"
                  fallback={<ImageIcon className="w-8 h-8 text-text-muted" />}
                />
              </div>
            ) : (
              <div className="mb-4 rounded-card bg-bg border border-border-subtle aspect-video flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-text-muted" />
              </div>
            )}

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="btn-secondary w-full mb-3"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading…' : 'Upload Still Image'}
            </button>

            {/* Status */}
            {status !== 'idle' && (
              <div
                className={`text-sm px-3 py-2 rounded-btn text-center ${
                  status === 'ok'
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : 'bg-red-500/10 text-red-300'
                }`}
              >
                {statusMsg}
              </div>
            )}

            {episode.overview && (
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <p className="text-xs text-text-secondary mb-2">Overview</p>
                <p className="text-sm text-text-primary/80 line-clamp-3">
                  {episode.overview}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
