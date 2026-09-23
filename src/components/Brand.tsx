import { Link } from 'react-router-dom'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" to="/" aria-label="VenueTwin home">
      <span className="brand-mark"><i /><i /><i /></span>
      {!compact && <span>VenueTwin</span>}
    </Link>
  )
}
