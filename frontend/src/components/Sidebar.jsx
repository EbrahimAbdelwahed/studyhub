import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Play, Activity, ListTree, Cpu, BookOpen, GraduationCap, Clock } from 'lucide-react';
import '../styles/global.css';

const Sidebar = () => {
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/drill', icon: Play, label: 'The Drill' },
    { path: '/forensics', icon: Activity, label: 'Forensics' },
    { path: '/syllabus', icon: ListTree, label: 'Syllabus' },
    { path: '/generator', icon: Cpu, label: 'Generator' },
    { path: '/generator/history', icon: Clock, label: 'History' },
    { path: '/library', icon: BookOpen, label: 'Library' },
  ];

  return (
    <nav className="sidebar">
      <div className="logo-container">
        <div className="logo">
          <GraduationCap size={24} />
        </div>
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
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-primary);
          transition: all var(--transition-fast);
        }

        .logo:hover {
          border-color: var(--color-primary);
          background: rgba(124, 58, 237, 0.1);
          color: var(--color-primary);
          box-shadow: 0 0 15px rgba(124, 58, 237, 0.2);
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
