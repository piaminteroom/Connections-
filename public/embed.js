/**
 * ConnectSphere Embeddable Widget
 * Easy integration for any website
 */

(function() {
  'use strict';
  
  // Default configuration
  const DEFAULT_CONFIG = {
    title: "Find Your Network",
    subtitle: "Discover professional connections instantly",
    primaryColor: "#64748b",
    accentColor: "#475569",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    showLogo: true,
    compactMode: false,
    maxWidth: "600px",
    showPoweredBy: true,
    apiEndpoint: "https://your-domain.com" // Replace with your actual domain
  };

  // Widget class
  class ConnectSphereWidget {
    constructor(containerId, config = {}) {
      this.containerId = containerId;
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.container = null;
      this.iframe = null;
      this.init();
    }

    init() {
      this.container = document.getElementById(this.containerId);
      if (!this.container) {
        console.error(`ConnectSphere: Container with ID "${this.containerId}" not found`);
        return;
      }

      this.createWidget();
      this.setupMessageListener();
    }

    createWidget() {
      // Create iframe for security and isolation
      this.iframe = document.createElement('iframe');
      this.iframe.src = `${this.config.apiEndpoint}/widget?` + new URLSearchParams(this.config).toString();
      this.iframe.style.cssText = `
        width: 100%;
        min-height: 400px;
        border: none;
        border-radius: ${this.config.borderRadius};
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        background: ${this.config.backgroundColor};
      `;
      this.iframe.setAttribute('scrolling', 'no');
      this.iframe.setAttribute('frameborder', '0');
      
      this.container.appendChild(this.iframe);
    }

    setupMessageListener() {
      window.addEventListener('message', (event) => {
        if (event.origin !== new URL(this.config.apiEndpoint).origin) return;
        
        const { type, data } = event.data;
        
        switch (type) {
          case 'connectsphere:resize':
            this.iframe.style.height = data.height + 'px';
            break;
          case 'connectsphere:connections-found':
            this.onConnectionsFound(data.connections);
            break;
          case 'connectsphere:error':
            this.onError(data.error);
            break;
        }
      });
    }

    onConnectionsFound(connections) {
      // Trigger custom event for the host website
      const event = new CustomEvent('connectsphere:connections', {
        detail: { connections }
      });
      document.dispatchEvent(event);
      
      // Call callback if provided
      if (this.config.onConnectionsFound) {
        this.config.onConnectionsFound(connections);
      }
    }

    onError(error) {
      // Trigger custom event for the host website
      const event = new CustomEvent('connectsphere:error', {
        detail: { error }
      });
      document.dispatchEvent(event);
      
      // Call callback if provided
      if (this.config.onError) {
        this.config.onError(error);
      }
    }

    // Public methods
    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      // Send message to iframe to update configuration
      this.iframe.contentWindow.postMessage({
        type: 'connectsphere:update-config',
        data: this.config
      }, this.config.apiEndpoint);
    }

    destroy() {
      if (this.iframe && this.iframe.parentNode) {
        this.iframe.parentNode.removeChild(this.iframe);
      }
    }
  }

  // Global initialization function
  window.ConnectSphereWidget = ConnectSphereWidget;

  // Auto-initialize widgets with data attributes
  document.addEventListener('DOMContentLoaded', function() {
    const widgets = document.querySelectorAll('[data-connectsphere]');
    
    widgets.forEach((element, index) => {
      const config = {};
      
      // Parse data attributes
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('data-cs-')) {
          const key = attr.name.replace('data-cs-', '').replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          config[key] = attr.value === 'true' ? true : attr.value === 'false' ? false : attr.value;
        }
      });
      
      // Generate unique ID if not provided
      if (!element.id) {
        element.id = `connectsphere-widget-${index}`;
      }
      
      new ConnectSphereWidget(element.id, config);
    });
  });

  // Simple embed for basic usage
  window.embedConnectSphere = function(containerId, config) {
    return new ConnectSphereWidget(containerId, config);
  };

})();

/**
 * Usage Examples:
 * 
 * 1. Simple HTML data attribute method:
 * <div data-connectsphere 
 *      data-cs-title="Find Connections"
 *      data-cs-primary-color="#3b82f6"
 *      data-cs-target-company="Microsoft">
 * </div>
 * 
 * 2. JavaScript initialization:
 * <div id="my-widget"></div>
 * <script>
 *   const widget = new ConnectSphereWidget('my-widget', {
 *     title: 'Custom Title',
 *     primaryColor: '#3b82f6',
 *     compactMode: true,
 *     onConnectionsFound: (connections) => console.log('Found:', connections)
 *   });
 * </script>
 * 
 * 3. Simple function call:
 * <div id="simple-widget"></div>
 * <script>
 *   embedConnectSphere('simple-widget', { compactMode: true });
 * </script>
 */