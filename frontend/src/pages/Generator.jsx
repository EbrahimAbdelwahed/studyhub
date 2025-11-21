import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { Cpu, Check, AlertTriangle, BookOpen, CheckSquare, Square } from 'lucide-react';
import { motion } from 'framer-motion';
import '../styles/global.css';

const Generator = () => {
    const [numCards, setNumCards] = useState(10);
    const [syllabus, setSyllabus] = useState({}); // Grouped by subject
    const [selectedUnits, setSelectedUnits] = useState(new Set());
    const [loadingSyllabus, setLoadingSyllabus] = useState(true);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSyllabus = async () => {
            try {
                const res = await client.get('/syllabus');
                // Group by subject
                const grouped = res.data.reduce((acc, unit) => {
                    const subject = unit.subject || 'Other';
                    if (!acc[subject]) acc[subject] = [];
                    acc[subject].push(unit);
                    return acc;
                }, {});
                setSyllabus(grouped);
            } catch (err) {
                console.error('Failed to fetch syllabus', err);
                setError('Failed to load syllabus structure.');
            } finally {
                setLoadingSyllabus(false);
            }
        };
        fetchSyllabus();
    }, []);

    const toggleUnit = (unitId) => {
        const newSelected = new Set(selectedUnits);
        if (newSelected.has(unitId)) {
            newSelected.delete(unitId);
        } else {
            newSelected.add(unitId);
        }
        setSelectedUnits(newSelected);
    };

    const toggleSubject = (subject, units) => {
        const newSelected = new Set(selectedUnits);
        const allSelected = units.every(u => newSelected.has(u.id));

        units.forEach(u => {
            if (allSelected) {
                newSelected.delete(u.id);
            } else {
                newSelected.add(u.id);
            }
        });
        setSelectedUnits(newSelected);
    };

    const handleGenerate = async () => {
        if (selectedUnits.size === 0) {
            setError('Please select at least one unit.');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await client.post('/generator/run', {
                num_cards: parseInt(numCards),
                units: Array.from(selectedUnits),
                model: 'gpt-5.1'
            });
            setResult(res.data);
        } catch (err) {
            setError('Failed to generate cards. ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="generator-page">
            <header>
                <h1 className="text-2xl font-bold">Generator</h1>
                <p className="text-muted">Select topics to generate new cards</p>
            </header>

            <div className="generator-layout">
                <div className="settings-panel card-panel">
                    <div className="form-group">
                        <label>Number of Cards</label>
                        <input
                            type="number"
                            value={numCards}
                            onChange={(e) => setNumCards(e.target.value)}
                            min="1"
                            max="50"
                            className="input-number"
                        />
                    </div>

                    <div className="selection-info">
                        <span className="text-muted">Selected Units:</span>
                        <span className="font-bold text-primary">{selectedUnits.size}</span>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={loading || selectedUnits.size === 0}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>Generating... <Cpu className="animate-spin" size={18} /></>
                        ) : (
                            <>Generate Cards <Cpu size={18} /></>
                        )}
                    </button>

                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="result-success"
                        >
                            <Check size={18} />
                            <div>
                                <strong>Success!</strong>
                                <div className="text-sm">Generated {result.created} cards</div>
                            </div>
                        </motion.div>
                    )}

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="result-error"
                        >
                            <AlertTriangle size={18} />
                            <div>{error}</div>
                        </motion.div>
                    )}
                </div>

                <div className="syllabus-selection card-panel">
                    {loadingSyllabus ? (
                        <div className="p-4 text-center text-muted">Loading syllabus...</div>
                    ) : (
                        Object.entries(syllabus).map(([subject, units]) => (
                            <div key={subject} className="subject-group">
                                <div
                                    className="subject-header"
                                    onClick={() => toggleSubject(subject, units)}
                                >
                                    <h3 className="font-bold">{subject}</h3>
                                    <span className="text-sm text-muted">{units.length} units</span>
                                </div>

                                <div className="units-grid">
                                    {units.map(unit => {
                                        const isSelected = selectedUnits.has(unit.id);
                                        return (
                                            <div
                                                key={unit.id}
                                                className={`unit-option ${isSelected ? 'selected' : ''}`}
                                                onClick={() => toggleUnit(unit.id)}
                                            >
                                                <div className="checkbox">
                                                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                                </div>
                                                <div className="unit-info">
                                                    <div className="unit-title">{unit.title}</div>
                                                    <div className="unit-id">{unit.id}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <style>{`
        .generator-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .generator-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: var(--spacing-lg);
          align-items: start;
        }
        
        .settings-panel {
          position: sticky;
          top: 100px;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }
        
        .syllabus-selection {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
        }
        
        .subject-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }
        
        .subject-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: var(--spacing-sm);
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          user-select: none;
        }
        
        .subject-header:hover h3 {
          color: var(--color-primary);
        }
        
        .units-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: var(--spacing-md);
        }
        
        .unit-option {
          display: flex;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .unit-option:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--text-muted);
        }
        
        .unit-option.selected {
          background: rgba(217, 119, 87, 0.1);
          border-color: var(--color-primary);
        }
        
        .checkbox {
          color: var(--text-muted);
          display: flex;
          align-items: flex-start;
          padding-top: 2px;
        }
        
        .unit-option.selected .checkbox {
          color: var(--color-primary);
        }
        
        .unit-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .unit-title {
          font-weight: 500;
          font-size: 0.9rem;
          line-height: 1.3;
        }
        
        .unit-id {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: monospace;
        }
        
        .input-number {
          width: 100%;
          padding: var(--spacing-md);
          background: var(--bg-app);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 1rem;
          outline: none;
        }
        
        .input-number:focus {
          border-color: var(--color-primary);
        }
        
        .selection-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-sm) 0;
          border-top: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
        }
        
        .text-primary { color: var(--color-primary); }
        
        .result-success {
          padding: var(--spacing-md);
          background: rgba(74, 222, 128, 0.1);
          color: var(--color-success);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }
        
        .result-error {
          padding: var(--spacing-md);
          background: rgba(248, 113, 113, 0.1);
          color: var(--color-danger);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        @media (max-width: 768px) {
          .generator-layout {
            grid-template-columns: 1fr;
          }
          .settings-panel {
            position: static;
          }
        }
      `}</style>
        </div>
    );
};

export default Generator;
