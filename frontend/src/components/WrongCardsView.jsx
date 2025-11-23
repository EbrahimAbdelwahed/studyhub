import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, RotateCcw, XCircle, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import client from '../api/client';
import '../styles/global.css';

const WrongCardsView = () => {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedCardId, setExpandedCardId] = useState(null);

    useEffect(() => {
        const fetchWrongCards = async () => {
            try {
                const res = await client.get('/cards/wrong');
                setCards(res.data);
            } catch (err) {
                console.error('Failed to fetch wrong cards', err);
            } finally {
                setLoading(false);
            }
        };

        fetchWrongCards();
    }, []);

    const toggleExpand = (cardId) => {
        setExpandedCardId(expandedCardId === cardId ? null : cardId);
    };

    if (loading) {
        return <div className="p-4 text-center text-muted">Loading wrong cards...</div>;
    }

    if (cards.length === 0) {
        return (
            <div className="card-panel flex flex-col items-center justify-center p-8 text-center">
                <div className="bg-green-500/10 p-4 rounded-full mb-4">
                    <Activity className="text-green-500" size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Clean Sheet!</h3>
                <p className="text-muted">You don't have any cards with errors. Great job!</p>
            </div>
        );
    }

    return (
        <div className="wrong-cards-view">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={24} />
                Critical Attention Needed
                <span className="text-sm font-normal text-muted ml-auto">{cards.length} cards</span>
            </h2>

            <div className="grid gap-4">
                {cards.map((item) => {
                    const { card, stats, recent_attempts } = item;
                    const isExpanded = expandedCardId === card.card_id;

                    return (
                        <motion.div
                            key={card.card_id}
                            layout
                            className={`wrong-card-item ${isExpanded ? 'expanded' : ''}`}
                            onClick={() => toggleExpand(card.card_id)}
                        >
                            <div className="wrong-card-header">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="tag text-xs">{card.dm418_tag}</span>
                                        <span className="text-xs text-muted">{card.type}</span>
                                    </div>
                                    <h3 className="font-medium text-lg pr-8 line-clamp-1">{card.question}</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="stat-pill text-red-400">
                                        <XCircle size={16} />
                                        <span>{stats.failures} fails</span>
                                    </div>
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>
                            </div>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="wrong-card-details"
                                    >
                                        <div className="stats-grid">
                                            <div className="stat-box">
                                                <span className="label">Total Attempts</span>
                                                <span className="value">{stats.total_attempts}</span>
                                            </div>
                                            <div className="stat-box">
                                                <span className="label">Failure Rate</span>
                                                <span className="value text-red-400">
                                                    {Math.round((stats.failures / stats.total_attempts) * 100)}%
                                                </span>
                                            </div>
                                            <div className="stat-box">
                                                <span className="label">Avg Time</span>
                                                <span className="value flex items-center gap-1">
                                                    <Clock size={14} />
                                                    {Math.round(stats.avg_time_s)}s
                                                </span>
                                            </div>
                                            <div className="stat-box">
                                                <span className="label">Last Attempt</span>
                                                <span className="value text-xs">
                                                    {new Date(stats.last_answered_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <h4 className="text-sm font-bold text-muted mb-2 uppercase tracking-wider">Recent History</h4>
                                            <div className="history-list">
                                                {recent_attempts.slice(0, 3).map((attempt, idx) => (
                                                    <div key={idx} className="history-item">
                                                        <span className={`outcome-dot ${attempt.outcome}`}></span>
                                                        <span className="text-sm flex-1 truncate">
                                                            {attempt.given_answer || '(No answer)'}
                                                        </span>
                                                        <span className="text-xs text-muted whitespace-nowrap">
                                                            {new Date(attempt.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            <style>{`
                .wrong-cards-view {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                }

                .wrong-card-item {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    cursor: pointer;
                    transition: all var(--transition-fast);
                }

                .wrong-card-item:hover {
                    border-color: var(--color-primary);
                    background: var(--bg-surface-hover);
                }

                .wrong-card-item.expanded {
                    border-color: var(--color-primary);
                    background: var(--bg-surface);
                    box-shadow: var(--shadow-md);
                }

                .wrong-card-header {
                    padding: var(--spacing-md);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .stat-pill {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    background: rgba(248, 113, 113, 0.1);
                    padding: 4px 10px;
                    border-radius: 20px;
                }

                .wrong-card-details {
                    border-top: 1px solid var(--border-color);
                    background: rgba(0, 0, 0, 0.2);
                    padding: var(--spacing-md);
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: var(--spacing-md);
                    margin-bottom: var(--spacing-md);
                }

                .stat-box {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .stat-box .label {
                    font-size: 0.7rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                }

                .stat-box .value {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .history-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .history-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: var(--radius-sm);
                }

                .outcome-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .outcome-dot.correct { background: var(--color-success); }
                .outcome-dot.wrong { background: var(--color-danger); }
                .outcome-dot.skip { background: var(--text-muted); }
            `}</style>
        </div>
    );
};

export default WrongCardsView;
