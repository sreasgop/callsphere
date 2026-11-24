import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('CallSphere React ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    width: '100vw',
                    color: '#fff',
                    background: '#050508',
                    padding: '20px',
                    textAlign: 'center'
                }}>
                    <h2 style={{ marginBottom: '10px', color: '#ff7675' }}>Something went wrong</h2>
                    <p style={{ color: '#cbd5e1', maxWidth: '500px', marginBottom: '20px' }}>
                        {this.state.error?.toString() || 'An unexpected rendering error occurred.'}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: '#6c5ce7',
                            color: '#fff',
                            border: 'none',
                            padding: '10px 24px',
                            borderRadius: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        Reload CallSphere
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
