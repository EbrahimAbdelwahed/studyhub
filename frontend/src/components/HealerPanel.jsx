import React, { useState } from 'react';
import client from '../api/client';
import { Wrench, Check, AlertTriangle, Play, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
                    <Wrench size={20} />
                </div>
                <div className="header-text">
                    <h3>MCQ Healer</h3>
                    <p>Fix broken MCQs by inferring missing answer keys.</p>
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

            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="result-success"
                    >
                        <div className="success-icon">
                            <Check size={20} />
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
                                <div className="metric">
                                    <span className="value">{result.inferred}</span>
                                    <span className="label">Inferred</span>
                                </div>
                                <div className="metric">
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
                        <AlertTriangle size={20} />
                        <div>{error}</div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                    padding-bottom: var(--spacing-md);
                    border-bottom: 1px solid var(--border-color);
                }

                .icon-wrapper {
                    width: 40px;
                    height: 40px;
                    background: var(--bg-app);
                    color: var(--color-primary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .header-text h3 {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                }

                .header-text p {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    margin: 2px 0 0 0;
                }

                .controls {
                    display: flex;
                    align-items: flex-end;
                    gap: var(--spacing-lg);
                    flex-wrap: wrap;
                }

                .control-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .control-group label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .checkbox-label {
                    flex-direction: row !important;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    height: 42px;
                    user-select: none;
                }

                .checkbox-label input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    accent-color: var(--color-primary);
                    cursor: pointer;
                }

                .input-number {
                    padding: 8px 12px;
                    background: var(--bg-app);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    width: 100px;
                    font-family: inherit;
                }

                .input-number:focus {
                    border-color: var(--color-primary);
                    outline: none;
                }

                .btn-primary {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    background: var(--color-primary);
                    color: white;
                    border: 1px solid rgba(0,0,0,0.1);
                    border-radius: var(--radius-md);
                    font-weight: 600;
                    cursor: pointer;
                    transition: all var(--transition-fast);
                    box-shadow: var(--shadow-sm);
                }

                .btn-primary:hover:not(:disabled) {
                    background: var(--color-primary-hover);
                    transform: translate(-1px, -1px);
                    box-shadow: var(--shadow-md);
                }

                .btn-primary:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    box-shadow: none;
                }

                .result-success {
                    background: rgba(74, 222, 128, 0.1);
                    border: 1px solid rgba(74, 222, 128, 0.2);
                    border-radius: var(--radius-md);
                    padding: var(--spacing-md);
                    display: flex;
                    gap: var(--spacing-md);
                }

                .result-error {
                    background: rgba(248, 113, 113, 0.1);
                    border: 1px solid rgba(248, 113, 113, 0.2);
                    border-radius: var(--radius-md);
                    padding: var(--spacing-md);
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                    color: var(--color-danger);
                }

                .success-icon {
                    color: var(--color-success);
                    display: flex;
                    align-items: flex-start;
                    padding-top: 2px;
                }

                .success-title {
                    font-weight: 600;
                    color: var(--color-success);
                    margin-bottom: var(--spacing-sm);
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: var(--spacing-lg);
                }

                .metric {
                    display: flex;
                    flex-direction: column;
                }

                .metric .value {
                    font-weight: 700;
                    font-size: 1.25rem;
                    color: var(--text-primary);
                }

                .metric .label {
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    color: var(--text-muted);
                }
            `}</style>
        </div >
    );
};

export default HealerPanel;

