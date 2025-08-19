import React from 'react';
import ConnectionFinder from './ConnectionFinder';
import WidgetPage from './WidgetPage';
import './App.css';

function App() {
  // Check if this is the widget page
  const isWidgetPage = window.location.pathname === '/widget' || window.location.search.includes('widget=true');

  return (
    <div className="App">
      {isWidgetPage ? <WidgetPage /> : <ConnectionFinder />}
    </div>
  );
}

export default App; 