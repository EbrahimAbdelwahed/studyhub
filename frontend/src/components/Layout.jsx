import React from 'react';
import Sidebar from './Sidebar';
import '../styles/global.css';

const Layout = ({ children }) => {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>

      <style>{`
        .layout {
          display: flex;
          min-height: 100vh;
          background-color: var(--bg-app);
        }
        
        .main-content {
          flex: 1;
          margin-left: 80px; /* Sidebar width */
          padding: var(--spacing-2xl);
          min-height: 100vh;
          overflow-y: auto;
          max-width: 1400px;
          margin-right: auto;
        }
      `}</style>
    </div>
  );
};

export default Layout;
