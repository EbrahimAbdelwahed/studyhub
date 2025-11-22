import React, { useState } from 'react';
import client from '../api/client';
import { Wrench, Check, AlertTriangle, Play, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import '../styles/global.css';

const HealerPanel = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [tryInfer, setTryInfer] = useState(true);
    const [limit, setLimit] = useState(200);

    const handleHeal = async () => {
        setLoading(true);
        setResult(null);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.set('try_infer', tryInfer);
            params.set('limit', limit);
            params.set('model', 'gpt-5.1');

            const res = await client.post(`/maintenance/heal-mcq-cloze?${params.toString()}`);
            setResult(res.data);
        } catch (err) {
            console.error('Heal failed', err);
            setError('Failed to execute healing process. ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="healer-panel card-panel">
            <div className="panel-header">
                <div className="icon-wrapper">
                    <Wrench size={24} />
                </div>
                <div>
                    <h2>MCQ Healer</h2>
                    <p className="text-muted">Fix broken MCQs by inferring missing answer keys.</p>
                </div>
            </div>

            <div className="controls">
                <div className="control-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={tryInfer}
                            onChange={(e) => setTryInfer(e.target.checked)}
                        />
                        <span>Try Inference (AI)</span>
                    </label>
                </div>

                <div className="control-group">
                    <label>Limit</label>
                    <input
                        type="number"
                        value={limit}
                        onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
                        min="1"
                        max="1000"
                        className="input-number"
                    />
                </div>

                <button
                    onClick={handleHeal}
                    disabled={loading}
                    className="btn-primary"
                >
                    {loading ? (
                        <>Healing... <Loader2 className="animate-spin" size={18} /></>
                    ) : (
                        <>Start Healing <Play size={18} /></>
                    )}
                </button>
            </div>

            {result && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="result-success"
                >
                    <div className="success-icon">
                        <Check size={24} />
                    </div>
                    <div className="success-content">
                        <div className="success-title">Healing Complete</div>
                        <div className="metrics-grid">
                            <div className="metric">
                                <span className="value">{result.scanned}</span>
                                <span className="label">Scanned</span>
                            </div>
                            <div className="metric">
                                <span className="value">{result.updated}</span>
                                <span className="label">Updated</span>
                            </div>
                            <div className="metric text-primary">
                                <span className="value">{result.inferred}</span>
                                <span className="label">Inferred</span>
                            </div>
                            <div className="metric text-warning">
                                <span className="value">{result.defaulted}</span>
                                <span className="label">Defaulted</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {error && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="result-error"
                >
                    <AlertTriangle size={18} />
                    <div>{error}</div>
                </motion.div>
            )}

            <style>{`
                .healer-panel {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-lg);
                }

                .panel-header {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                }

                .icon-wrapper {
                    width: 48px;
                    height: 48px;
                    background: rgba(124, 58, 237, 0.1);
                    color: var(--color-primary);
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .controls {
                    display: flex;
                    align-items: flex-end;
                    gap: var(--spacing-lg);
                    flex-wrap: wrap;
                    padding: var(--spacing-md);
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: var(--radius-md);
                }

                .control-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .control-group label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .checkbox-label {
                    flex-direction: row !important;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    height: 42px; 
                }

                .input-number {
                    padding: 8px 12px;
                    background: var(--bg-app);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    width: 100px;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: var(--spacing-md);
                    margin-top: var(--spacing-sm);
                }

                .metric {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }

                .metric .value {
                    font-weight: 700;
                    font-size: 1.25rem;
                }

                .metric .label {
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    opacity: 0.7;
                }
            `}</style>
        </div>
    );
};

export default HealerPanel;
