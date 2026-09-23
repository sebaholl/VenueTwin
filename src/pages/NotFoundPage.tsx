import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <main className="not-found"><span>404</span><h1>This seat does not exist.</h1><p>The page you are looking for is outside this venue.</p><Link className="button button-primary" to="/">Return home</Link></main>
}
