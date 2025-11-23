import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { useSyllabus } from '../contexts/SyllabusContext';
import { BookOpen, Trash2 } from 'lucide-react';
import '../styles/global.css';

const Syllabus = () => {
  const { syllabusList, loading: syllabusLoading } = useSyllabus();
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = useCallback(() => {
    setLoadingStats(true);
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

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleDeleteUnit = async (unitId, unitTitle) => {
    if (!confirm(`Are you sure you want to clear all cards and progress for "${unitTitle || unitId}"? This cannot be undone.`)) {
      return;
    }

    try {
      await client.delete(`/cards/by-syllabus/${unitId}`);
      // Refresh stats to show cleared status
      fetchStats();
    } catch (err) {
      console.error('Failed to delete unit cards:', err);
      alert('Failed to clear unit: ' + (err.response?.data?.detail || err.message));
    }
  };

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
                    <div key={unit.id} className="unit-item group">
                      <div className="flex items-center gap-3">
                        <div className="unit-name">{unit.title || unit.id}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`unit-status ${unitStats.status?.toLowerCase() || 'untouched'}`}>
                          {unitStats.score || 0}%
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeleteUnit(unit.id, unit.title);
                          }}
                          className="p-1.5 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                          title="Clear all cards for this unit"
                        >
                          <Trash2 size={16} />
                        </button>
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
          align-items: center;
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
