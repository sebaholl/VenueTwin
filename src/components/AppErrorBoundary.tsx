import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('VenueTwin render error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return <main className="app-error-fallback">
      <span>VENUE TWIN</span>
      <h1>The editor hit an unexpected error.</h1>
      <p>{this.state.error.message}</p>
      <button onClick={() => window.location.reload()}>Reload editor</button>
    </main>
  }
}
