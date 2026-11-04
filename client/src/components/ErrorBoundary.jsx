import { Component } from 'react';

/** Last line of defence: never leave the player staring at a blank page. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16, textAlign: 'center' }}>
        <div className="panel" style={{ padding: 28, maxWidth: 420 }}>
          <div className="emoji" style={{ fontSize: 64 }}>🙀</div>
          <h2 style={{ fontFamily: 'var(--font-display)' }}>Something went kaboom</h2>
          <p className="muted">The page hit an unexpected error. Reloading puts you back in your room.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
