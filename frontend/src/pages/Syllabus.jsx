import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useSyllabus } from '../contexts/SyllabusContext';
import { BookOpen } from 'lucide-react';
import '../styles/global.css';

const Syllabus = () => {
  const { syllabusList, loading: syllabusLoading } = useSyllabus();
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    client.get('/analytics/heatmap')
      .then(res => {
        // Transform array response to a map for easier lookup: { unitId: { score, status } }
        const statsMap = {};
        res.data.forEach(subject => {
          subject.children.forEach(unit => {
            statsMap[unit.id] = unit;
          });
        });
        setStats(statsMap);
      })
      .catch(err => console.error("Failed to fetch heatmap", err))
      .finally(() => setLoadingStats(false));
  }, []);

  // Group syllabusList by subject
  const groupedSyllabus = React.useMemo(() => {
    const groups = {};
    syllabusList.forEach(unit => {
      const subject = unit.subject || 'Other';
      if (!groups[subject]) {
        groups[subject] = [];
      }
      groups[subject].push(unit);
    });
    return Object.entries(groups).map(([subject, units]) => ({
      id: subject,
      children: units
    }));
  }, [syllabusList]);

  if (syllabusLoading) return <div className="p-8 text-center">Loading syllabus...</div>;

  return (
    <div className="syllabus-page">
      <header>
        <h1 className="text-2xl font-bold">Syllabus Tree</h1>
        <p className="text-muted">Hierarchical view of the curriculum</p>
      </header>

      <div className="syllabus-tree card-panel">
        {groupedSyllabus.length === 0 ? (
          <div className="text-center p-8 text-muted flex flex-col items-center gap-4">
            <p>No syllabus data found. Import a syllabus to get started.</p>
            <button
              onClick={() => {
                if (confirm('Import default syllabus (Chemistry & Physics)?')) {
                  setLoadingStats(true);
                  client.post('/import/defaults')
                    .then(() => window.location.reload())
                    .catch(err => alert('Failed to import: ' + err));
                }
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Import Default Syllabus
            </button>
          </div>
        ) : (
          groupedSyllabus.map(subject => (
            <details key={subject.id} open className="subject-details">
              <summary className="subject-summary">
                <BookOpen size={18} />
                {subject.id}
              </summary>
              <div className="units-list">
                {subject.children.map(unit => {
                  const unitStats = stats[unit.id] || {};
                  return (
                    <div key={unit.id} className="unit-item">
                      <div className="unit-name">{unit.title || unit.id}</div>
                      <div className={`unit-status ${unitStats.status?.toLowerCase() || 'untouched'}`}>
                        {unitStats.score || 0}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          ))
        )}
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
