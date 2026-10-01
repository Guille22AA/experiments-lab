// If a screen crashes because of a bug, show a friendly message instead of a
// blank page. (React only supports this with a class component.)
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Screen error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center-screen">
        <p className="notice error">Algo ha fallado en esta pantalla. Tus datos están a salvo.</p>
        <button className="button" onClick={() => window.location.assign('/menu')}>
          Volver al inicio
        </button>
      </div>
    );
  }
}
