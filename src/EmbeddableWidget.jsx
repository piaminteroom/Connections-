import React, { useState, useEffect } from 'react';
import { Search, Building, GraduationCap, Users, Loader2, ExternalLink, Mail, Sparkles } from 'lucide-react';

const EmbeddableWidget = ({ 
  config = {},
  onConnectionsFound = () => {},
  onError = () => {}
}) => {
  // Widget configuration with defaults
  const {
    title = "Find Your Network",
    subtitle = "Discover professional connections instantly",
    primaryColor = "#64748b",
    accentColor = "#475569",
    backgroundColor = "#ffffff",
    borderRadius = "16px",
    showLogo = true,
    compactMode = false,
    maxWidth = "600px",
    targetCompany = "",
    apiEndpoint = window.location.origin, // Use the same domain by default
    showPoweredBy = true
  } = config;

  const [formData, setFormData] = useState({
    targetCompany: targetCompany || '',
    previousCompany: '',
    school: '',
    yourName: ''
  });
  
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(!compactMode);

  // Dynamic CSS variables for theming
  useEffect(() => {
    const widget = document.getElementById('connectsphere-widget');
    if (widget) {
      widget.style.setProperty('--primary-color', primaryColor);
      widget.style.setProperty('--accent-color', accentColor);
      widget.style.setProperty('--background-color', backgroundColor);
      widget.style.setProperty('--border-radius', borderRadius);
      widget.style.setProperty('--max-width', maxWidth);
    }
  }, [primaryColor, accentColor, backgroundColor, borderRadius, maxWidth]);

  const discoverConnections = async () => {
    if (!formData.targetCompany || !formData.previousCompany || !formData.school || !formData.yourName) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call the main app's API endpoint
      const response = await fetch(`${apiEndpoint}/api/discover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to discover connections');
      }

      const data = await response.json();
      setConnections(data.connections || []);
      onConnectionsFound(data.connections || []);
      
    } catch (err) {
      const errorMsg = err.message || 'Something went wrong';
      setError(errorMsg);
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const widgetStyles = {
    '--primary-color': primaryColor,
    '--accent-color': accentColor,
    '--background-color': backgroundColor,
    '--border-radius': borderRadius,
    '--max-width': maxWidth
  };

  return (
    <div 
      id="connectsphere-widget"
      style={widgetStyles}
      className="connectsphere-widget"
    >
      <style>{`
        .connectsphere-widget {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          max-width: var(--max-width);
          background: var(--background-color);
          border-radius: var(--border-radius);
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          position: relative;
        }
        
        .connectsphere-widget * {
          box-sizing: border-box;
        }
        
        .widget-header {
          background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
          color: white;
          padding: ${compactMode ? '1rem' : '1.5rem'};
          text-align: center;
        }
        
        .widget-content {
          padding: ${compactMode ? '1rem' : '1.5rem'};
        }
        
        .widget-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 0.75rem;
          transition: border-color 0.2s;
        }
        
        .widget-input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(100, 116, 139, 0.2);
        }
        
        .widget-button {
          width: 100%;
          background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        
        .widget-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(100, 116, 139, 0.3);
        }
        
        .widget-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .widget-connection-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 0.75rem;
        }
        
        .widget-connection-name {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 0.25rem;
        }
        
        .widget-connection-title {
          color: #6b7280;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }
        
        .widget-connection-actions {
          display: flex;
          gap: 0.5rem;
        }
        
        .widget-action-btn {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid var(--primary-color);
          background: white;
          color: var(--primary-color);
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          text-decoration: none;
        }
        
        .widget-action-btn:hover {
          background: var(--primary-color);
          color: white;
        }
        
        .widget-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }
        
        .widget-expand-toggle {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          position: absolute;
          top: 1rem;
          right: 1rem;
          transition: background-color 0.2s;
        }
        
        .widget-expand-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .widget-powered-by {
          text-align: center;
          padding: 0.75rem;
          border-top: 1px solid #e2e8f0;
          font-size: 0.75rem;
          color: #6b7280;
        }
        
        .widget-powered-by a {
          color: var(--primary-color);
          text-decoration: none;
          font-weight: 500;
        }
        
        .widget-powered-by a:hover {
          text-decoration: underline;
        }
        
        @media (max-width: 480px) {
          .connectsphere-widget {
            border-radius: 0;
            box-shadow: none;
            border-left: none;
            border-right: none;
          }
        }
      `}</style>

      {/* Header */}
      <div className="widget-header">
        {compactMode && (
          <button 
            className="widget-expand-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '−' : '+'}
          </button>
        )}
        
        {showLogo && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Sparkles size={20} />
            <span style={{ fontWeight: '800', fontSize: compactMode ? '1.1rem' : '1.3rem' }}>
              ConnectSphere
            </span>
          </div>
        )}
        
        <h3 style={{ margin: 0, fontSize: compactMode ? '1rem' : '1.2rem', fontWeight: '600' }}>
          {title}
        </h3>
        {!compactMode && (
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Content */}
      {(isExpanded || !compactMode) && (
        <div className="widget-content">
          {error && (
            <div className="widget-error">
              {error}
            </div>
          )}

          {/* Form */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Target Company (e.g., Microsoft)"
              value={formData.targetCompany}
              onChange={(e) => setFormData({...formData, targetCompany: e.target.value})}
              className="widget-input"
            />
            
            <input
              type="text"
              placeholder="Previous Company (e.g., Google)"
              value={formData.previousCompany}
              onChange={(e) => setFormData({...formData, previousCompany: e.target.value})}
              className="widget-input"
            />
            
            <input
              type="text"
              placeholder="School/University (e.g., Stanford)"
              value={formData.school}
              onChange={(e) => setFormData({...formData, school: e.target.value})}
              className="widget-input"
            />
            
            <input
              type="text"
              placeholder="Your Name (e.g., Alex Chen)"
              value={formData.yourName}
              onChange={(e) => setFormData({...formData, yourName: e.target.value})}
              className="widget-input"
              style={{ marginBottom: 0 }}
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={discoverConnections}
            disabled={loading}
            className="widget-button"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Discovering...
              </>
            ) : (
              <>
                <Search size={16} />
                Find Connections
              </>
            )}
          </button>

          {/* Results */}
          {connections.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#374151', fontSize: '1rem' }}>
                Found {connections.length} connections:
              </h4>
              
              {connections.slice(0, compactMode ? 3 : 5).map((connection, index) => (
                <div key={index} className="widget-connection-card">
                  <div className="widget-connection-name">{connection.name}</div>
                  <div className="widget-connection-title">{connection.title}</div>
                  
                  <div className="widget-connection-actions">
                    <a
                      href={connection.linkedinUrl || `https://linkedin.com/in/${connection.name.toLowerCase().replace(/\s+/g, '-')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="widget-action-btn"
                    >
                      <ExternalLink size={14} />
                      LinkedIn
                    </a>
                    <a
                      href={`mailto:${connection.primaryEmail}?subject=Connection from ${formData.yourName}`}
                      className="widget-action-btn"
                    >
                      <Mail size={14} />
                      Email
                    </a>
                  </div>
                </div>
              ))}
              
              {connections.length > (compactMode ? 3 : 5) && (
                <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', margin: '0.5rem 0 0 0' }}>
                  +{connections.length - (compactMode ? 3 : 5)} more connections found
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Powered By */}
      {showPoweredBy && (
        <div className="widget-powered-by">
          Powered by <a href="#" target="_blank">ConnectSphere</a>
        </div>
      )}
    </div>
  );
};

export default EmbeddableWidget;