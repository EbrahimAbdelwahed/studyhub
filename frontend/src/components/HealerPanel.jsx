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
        <div className="healer-container">
            <div className="healer-header">
                <div className="icon-glow">
                    <Sparkles size={20} />
                </div>
                <div className="header-text">
                    <h3>MCQ Healer</h3>
                    <p>Intelligent repair for broken question cards</p>
                </div>
            </div>

            <div className="healer-body">
                <div className="controls-row">
                    <div className="control-item">
                        <label>Inference Mode</label>
                        <button
                            className={`toggle-switch ${tryInfer ? 'active' : ''}`}
                            onClick={() => setTryInfer(!tryInfer)}
                            type="button"
                        >
                            <div className="toggle-handle" />
                        </button>
                        <span className="toggle-label">{tryInfer ? 'AI Enabled' : 'Manual Only'}</span>
                    </div>

                    <div className="control-item">
                        <label>Batch Limit</label>
                        <input
                            type="number"
                            value={limit}
                            onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
                            min="1"
                            max="1000"
                            className="input-premium"
                        />
                    </div>

                    <div className="control-spacer" />

                    <button
                        onClick={handleHeal}
                        disabled={loading}
                        className="btn-premium"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                <span>Healing...</span>
                            </>
                        ) : (
                            <>
                                <Play size={18} fill="currentColor" />
                                <span>Start Repair</span>
                            </>
                        )}
                    </button>
                </div>

                <AnimatePresence>
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="result-card success"
                        >
                            <div className="result-header">
                                <div className="status-icon success"><Check size={16} /></div>
                                <span>Repair Complete</span>
                            </div>
                            <div className="stats-row">
                                <div className="stat">
                                    <span className="value">{result.scanned}</span>
                                    <span className="label">Scanned</span>
                                </div>
                                <div className="stat">
                                    <span className="value">{result.updated}</span>
                                    <span className="label">Fixed</span>
                                </div>
                                <div className="stat highlight">
                                    <span className="value">{result.inferred}</span>
                                    <span className="label">AI Inferred</span>
                                </div>
                                <div className="stat warning">
                                    <span className="value">{result.defaulted}</span>
                                    <span className="label">Defaulted</span>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="result-card error"
                        >
                            <div className="result-header">
                                <div className="status-icon error"><AlertTriangle size={16} /></div>
                                <span>Error Occurred</span>
                            </div>
                            <p className="error-msg">{error}</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style>{`
                .healer-container {
                    background: rgba(30, 41, 59, 0.4);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: var(--radius-xl);
                    overflow: hidden;
                    transition: border-color 0.3s ease;
                }

                .healer-container:hover {
                    border-color: rgba(255, 255, 255, 0.15);
                }

                .healer-header {
                    padding: 20px 24px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    background: rgba(0, 0, 0, 0.1);
                }

                .icon-glow {
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(59, 130, 246, 0.2));
                    color: #a78bfa;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 20px rgba(124, 58, 237, 0.1);
                    border: 1px solid rgba(124, 58, 237, 0.2);
                }

                .header-text h3 {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                    letter-spacing: -0.01em;
                }

                .header-text p {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    margin: 2px 0 0 0;
                }

                .healer-body {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .controls-row {
                    display: flex;
                    align-items: flex-end;
                    gap: 24px;
                    flex-wrap: wrap;
                }

                .control-item {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .control-item label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .toggle-switch {
                    width: 44px;
                    height: 24px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    position: relative;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .toggle-switch.active {
                    background: var(--color-primary);
                    border-color: var(--color-primary);
                    box-shadow: 0 0 10px rgba(124, 58, 237, 0.3);
                }

                .toggle-handle {
                    width: 18px;
                    height: 18px;
                    background: white;
                    border-radius: 50%;
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    transition: transform 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }

                .toggle-switch.active .toggle-handle {
                    transform: translateX(20px);
                }

                .toggle-label {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin-top: 4px;
                }

                .input-premium {
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 10px 12px;
                    color: var(--text-primary);
                    font-size: 0.9rem;
                    width: 100px;
                    transition: all 0.2s ease;
                }

                .input-premium:focus {
                    border-color: var(--color-primary);
                    background: rgba(0, 0, 0, 0.3);
                    outline: none;
                }

                .control-spacer {
                    flex: 1;
                }

                .btn-premium {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    background: linear-gradient(135deg, var(--color-primary), #7C3AED);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
                    text-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }

                .btn-premium:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(124, 58, 237, 0.35);
                    filter: brightness(1.1);
                }

                .btn-premium:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    transform: none;
                }

                .result-card {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 12px;
                    padding: 16px;
                    border: 1px solid transparent;
                }

                .result-card.success {
                    border-color: rgba(16, 185, 129, 0.2);
                    background: linear-gradient(to right, rgba(16, 185, 129, 0.05), transparent);
                }

                .result-card.error {
                    border-color: rgba(239, 68, 68, 0.2);
                    background: linear-gradient(to right, rgba(239, 68, 68, 0.05), transparent);
                }

                .result-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 12px;
                    font-weight: 600;
                    font-size: 0.95rem;
                }

                .status-icon {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .status-icon.success {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                }

                .status-icon.error {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }

                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                    gap: 16px;
                }

                .stat {
                    display: flex;
                    flex-direction: column;
                }

                .stat .value {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .stat .label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .stat.highlight .value { color: #a78bfa; }
                .stat.warning .value { color: #fbbf24; }

                .error-msg {
                    color: #fca5a5;
                    font-size: 0.9rem;
                    margin: 0;
                }
            `}</style>
        </div>
    );
};

export default HealerPanel;

