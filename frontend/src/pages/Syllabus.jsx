import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { BookOpen } from 'lucide-react';
import '../styles/global.css';

const Syllabus = () => {
    const [data, setData] = useState([]);

    useEffect(() => {
        client.get('/analytics/heatmap').then(res => setData(res.data));
    }, []);

    return (
        <div className="syllabus-page">
            <header>
                <h1 className="text-2xl font-bold">Syllabus Tree</h1>
                <p className="text-muted">Hierarchical view of the curriculum</p>
            </header>

            <div className="syllabus-tree card-panel">
                {data.map(subject => (
                    <details key={subject.id} open className="subject-details">
                        <summary className="subject-summary">
                            <BookOpen size={18} />
                            {subject.id}
                        </summary>
                        <div className="units-list">
                            {subject.children.map(unit => (
                                <div key={unit.id} className="unit-item">
                                    <div className="unit-name">{unit.id}</div>
                                    <div className={`unit-status ${unit.status?.toLowerCase() || 'untouched'}`}>
                                        {unit.score || 0}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </details>
                ))}
            </div>

            <style>{`
        .syllabus-page {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
        }
        
        .syllabus-tree {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
        }
        
        .subject-details {
          margin-bottom: var(--spacing-md);
        }
        
        .subject-summary {
          cursor: pointer;
          padding: var(--spacing-md);
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          list-style: none;
          background: var(--bg-surface-hover);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-sm);
        }
        
        .subject-summary::-webkit-details-marker {
          display: none;
        }
        
        .units-list {
          padding-left: var(--spacing-xl);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }
        
        .unit-item {
          display: flex;
          justify-content: space-between;
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-sm);
          transition: background var(--transition-fast);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .unit-item:hover {
          background: var(--bg-surface-hover);
        }
        
        .unit-status {
          font-weight: bold;
          font-size: 0.875rem;
        }
        
        .unit-status.safe { color: var(--color-success); }
        .unit-status.warning { color: var(--color-warning); }
        .unit-status.risk { color: var(--color-danger); }
        .unit-status.untouched { color: var(--text-muted); }
      `}</style>
        </div>
    );
};

export default Syllabus;
