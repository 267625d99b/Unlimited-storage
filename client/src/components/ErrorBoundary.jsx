import { Component } from 'react';
import { FiAlertTriangle, FiRefreshCw, FiHome } from 'react-icons/fi';

/**
 * Error Boundary Component
 * يلتقط أخطاء React ويعرض واجهة بديلة
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught:', error, errorInfo);
    }
    
    // In production, you could send to error tracking service
    // logErrorToService(error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary" role="alert" aria-live="assertive">
          <div className="error-boundary-content">
            <div className="error-icon">
              <FiAlertTriangle size={64} />
            </div>
            
            <h1>عذراً، حدث خطأ غير متوقع</h1>
            
            <p>
              نعتذر عن هذا الخطأ. يمكنك المحاولة مرة أخرى أو العودة للصفحة الرئيسية.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>تفاصيل الخطأ (للمطورين)</summary>
                <pre>{this.state.error.toString()}</pre>
                {this.state.errorInfo && (
                  <pre>{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}
            
            <div className="error-actions">
              <button onClick={this.handleRetry} className="retry-btn">
                <FiRefreshCw /> حاول مرة أخرى
              </button>
              <button onClick={this.handleGoHome} className="home-btn">
                <FiHome /> الصفحة الرئيسية
              </button>
            </div>
          </div>
          
          <style>{`
            .error-boundary {
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
              background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
              font-family: 'Cairo', sans-serif;
            }
            
            .error-boundary-content {
              background: white;
              border-radius: 16px;
              padding: 48px;
              text-align: center;
              max-width: 500px;
              box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
            }
            
            .error-icon {
              color: #f44336;
              margin-bottom: 24px;
            }
            
            .error-boundary h1 {
              color: #333;
              font-size: 24px;
              margin-bottom: 16px;
            }
            
            .error-boundary p {
              color: #666;
              line-height: 1.8;
              margin-bottom: 24px;
            }
            
            .error-details {
              text-align: left;
              direction: ltr;
              background: #f5f5f5;
              padding: 16px;
              border-radius: 8px;
              margin-bottom: 24px;
              max-height: 200px;
              overflow: auto;
            }
            
            .error-details summary {
              cursor: pointer;
              color: #666;
              margin-bottom: 12px;
            }
            
            .error-details pre {
              font-size: 12px;
              color: #d32f2f;
              white-space: pre-wrap;
              word-break: break-word;
            }
            
            .error-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
              flex-wrap: wrap;
            }
            
            .error-actions button {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 12px 24px;
              border-radius: 8px;
              font-size: 14px;
              font-family: inherit;
              cursor: pointer;
              transition: all 0.2s;
            }
            
            .retry-btn {
              background: #1a73e8;
              color: white;
              border: none;
            }
            
            .retry-btn:hover {
              background: #1557b0;
            }
            
            .home-btn {
              background: white;
              color: #333;
              border: 1px solid #ddd;
            }
            
            .home-btn:hover {
              background: #f5f5f5;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
