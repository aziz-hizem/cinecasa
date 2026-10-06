import os from 'node:os'
import { Bonjour } from 'bonjour-service'

let bonjour: Bonjour | null = null

/**
 * Advertise the server on the local network as `_cinecasa._tcp` so the tablet
 * app can find this PC without typing an IP address.
 */
export function advertise(port: number): void {
  stopAdvertising()
  try {
    bonjour = new Bonjour()
    bonjour.publish({
      name: `Cinecasa on ${os.hostname()}`,
      type: 'cinecasa',
      port,
      txt: { v: '1' },
      disableIPv6: true,
    })
  } catch (e) {
    // Discovery is a convenience — the tablet can still connect by IP.
    console.error('[remote] mDNS advertise failed:', e)
    stopAdvertising()
  }
}

export function stopAdvertising(): void {
  if (!bonjour) return
  const b = bonjour
  bonjour = null
  try {
    b.unpublishAll(() => b.destroy())
  } catch {
    b.destroy()
  }
}

/** Private IPv4 addresses of this PC, for display in Settings. */
export function lanAddresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address)
    }
  }
  return out
}
