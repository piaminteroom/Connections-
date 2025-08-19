import React, { useEffect, useState } from 'react';
import EmbeddableWidget from './EmbeddableWidget';

const WidgetPage = () => {
  const [config, setConfig] = useState({});

  useEffect(() => {
    // Parse URL parameters for configuration
    const urlParams = new URLSearchParams(window.location.search);
    const widgetConfig = {};
    
    // Convert URL parameters to config object
    for (const [key, value] of urlParams.entries()) {
      // Convert string values to appropriate types
      if (value === 'true') widgetConfig[key] = true;
      else if (value === 'false') widgetConfig[key] = false;
      else if (!isNaN(value) && value !== '') widgetConfig[key] = Number(value);
      else widgetConfig[key] = value;
    }
    
    setConfig(widgetConfig);

    // Listen for configuration updates from parent
    const handleMessage = (event) => {
      if (event.data.type === 'connectsphere:update-config') {
        setConfig(prevConfig => ({ ...prevConfig, ...event.data.data }));
      }
    };

    window.addEventListener('message', handleMessage);

    // Send initial height to parent
    const sendHeight = () => {
      const height = document.body.scrollHeight;
      window.parent.postMessage({
        type: 'connectsphere:resize',
        data: { height }
      }, '*');
    };

    // Send height on load and when content changes
    sendHeight();
    const resizeObserver = new ResizeObserver(sendHeight);
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener('message', handleMessage);
      resizeObserver.disconnect();
    };
  }, []);

  const handleConnectionsFound = (connections) => {
    // Notify parent window
    window.parent.postMessage({
      type: 'connectsphere:connections-found',
      data: { connections }
    }, '*');
  };

  const handleError = (error) => {
    // Notify parent window
    window.parent.postMessage({
      type: 'connectsphere:error',
      data: { error }
    }, '*');
  };

  return (
    <div style={{ 
      margin: 0, 
      padding: 0, 
      minHeight: '100vh',
      backgroundColor: 'transparent',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <EmbeddableWidget 
        config={config}
        onConnectionsFound={handleConnectionsFound}
        onError={handleError}
      />
    </div>
  );
};

export default WidgetPage;