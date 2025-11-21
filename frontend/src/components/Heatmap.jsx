import React from 'react';
import '../styles/global.css';

const Heatmap = ({ data }) => {
  if (!data || data.length === 0) return <div className="no-data">No data available</div>;

  return (
    <div className="heatmap-container">
      {data.map(subject => (
        <div key={subject.id} className="subject-section">
          <h3 className="subject-title">{subject.id}</h3>
          <div className="units-grid">
            {subject.children.map(unit => (
              <div
                key={unit.id}
                className={`unit-card ${unit.status?.toLowerCase() || 'untouched'}`}
                title={`${unit.id}: ${unit.score || 0}%`}
              >
                <div className="unit-title">{unit.id}</div>
                <div className="unit-score">{unit.score || 0}%</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <style>{`
        .heatmap-container {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }
        
        .subject-title {
          font-size: 1rem;
          color: var(--text-secondary);
          margin-bottom: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
          padding-bottom: var(--spacing-xs);
          font-weight: 500;
        }
        
        .units-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: var(--spacing-md);
        }
        
        .unit-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-md);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 110px;
          transition: all var(--transition-fast);
        }
        
        .unit-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: var(--text-muted);
        }
        
        .unit-card.safe {
          border-color: rgba(74, 222, 128, 0.3);
          background: rgba(74, 222, 128, 0.05);
        }
        
        .unit-card.safe .unit-score {
          color: var(--color-success);
        }
        
        .unit-card.warning {
          border-color: rgba(251, 191, 36, 0.3);
          background: rgba(251, 191, 36, 0.05);
        }
        
        .unit-card.warning .unit-score {
          color: var(--color-warning);
        }
        
        .unit-card.risk {
          border-color: rgba(248, 113, 113, 0.3);
          background: rgba(248, 113, 113, 0.05);
        }
        
        .unit-card.risk .unit-score {
          color: var(--color-danger);
        }
        
        .unit-card.untouched {
          opacity: 0.6;
        }
        
        .unit-title {
          font-size: 0.875rem;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          color: var(--text-secondary);
        }
        
        .unit-score {
          font-size: 1.5rem;
          font-weight: 700;
          align-self: flex-end;
          letter-spacing: -0.02em;
        }
      `}</style>
    </div>
  );
};

export default Heatmap;
