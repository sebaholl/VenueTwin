import type { VenueConfig } from '../types/venue'
import { pilotSnapshot } from '../utils/studioPilot'
import type { PendingPilotApproval } from './pilotSession'

export async function evidenceSha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function approvalIsCurrent(packet: PendingPilotApproval, config: VenueConfig, evidenceHash: string): boolean {
  return packet.base === pilotSnapshot(config) && packet.evidenceSha256 === evidenceHash
}
