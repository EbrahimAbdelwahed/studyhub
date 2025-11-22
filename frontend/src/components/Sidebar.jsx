import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Play, Activity, ListTree, Cpu, BookOpen } from 'lucide-react';
import '../styles/global.css';

const Sidebar = () => {
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/drill', icon: Play, label: 'The Drill' },
    { path: '/forensics', icon: Activity, label: 'Forensics' },
    { path: '/syllabus', icon: ListTree, label: 'Syllabus' },
    { path: '/generator', icon: Cpu, label: 'Generator' },
    { path: '/library', icon: BookOpen, label: 'Library' },
  ];

  return (
    <nav className="sidebar">
      <div className="logo-container">
        <div className="logo">M19</div>
      </div>

      <div className="nav-links">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
            title={item.label}
          >
            <item.icon size={22} strokeWidth={2} />
          </NavLink>
        ))}
      </div>

      <style>{`
        .sidebar {
          width: 80px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--spacing-xl) 0;
          position: fixed;
          left: 0;
          top: 0;
          z-index: 50;
        }
        
        .logo-container {
          margin-bottom: var(--spacing-2xl);
        }
        
        .logo {
          width: 40px;
          height: 40px;
          background: var(--color-primary);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: white;
          font-size: 0.875rem;
          box-shadow: var(--shadow-glow);
        }
        
        .nav-links {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
          width: 100%;
          align-items: center;
        }
        
        .nav-item {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-lg);
          color: var(--text-muted);
          transition: all var(--transition-fast);
        }
        
        .nav-item:hover {
          background-color: var(--bg-surface);
          color: var(--text-primary);
        }
        
        .nav-item.active {
          background-color: var(--bg-surface);
          color: var(--color-primary);
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--border-color);
        }
      `}</style>
    </nav>
  );
};

export default Sidebar;
