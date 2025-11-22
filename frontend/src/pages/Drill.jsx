import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import Card from '../components/Card';
import { Loader2, RefreshCw } from 'lucide-react';
import '../styles/global.css';

const Drill = () => {
    const [queue, setQueue] = useState([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [limit, setLimit] = useState(10);
    const [cardType, setCardType] = useState('ALL');
    const [includeNew, setIncludeNew] = useState(true);

    const fetchCards = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('limit', limit);
            params.set('include_new', includeNew);
            if (cardType !== 'ALL') {
                params.set('card_type', cardType);
            }

            const res = await client.get(`/cards/next?${params.toString()}`);
            setQueue(res.data);
            setCurrentCardIndex(0);
        } catch (err) {
            console.error('Failed to fetch cards', err);
        } finally {
            setLoading(false);
        }
    }, [limit, cardType, includeNew]);

    useEffect(() => {
        fetchCards();
    }, [fetchCards]);

    const handleAnswer = async (outcome, duration) => {
        const card = queue[currentCardIndex];

        // Optimistic update: Move to next card immediately after animation
        // But we need to submit the answer.

        try {
            await client.post(`/cards/${card.card_id}/answer`, {
                outcome,
                duration_s: duration
            });
        } catch (err) {
            console.error('Failed to submit answer', err);
        }

        if (currentCardIndex < queue.length - 1) {
            setCurrentCardIndex(prev => prev + 1);
        } else {
            // Queue finished, fetch more
            fetchCards();
        }
    };

    if (loading && queue.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin" size={48} color="var(--color-primary)" />
            </div>
        );
    }

    if (!loading && queue.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <h2 className="text-lg font-bold">No cards available</h2>
                <p className="text-muted">Great job! You've cleared the queue.</p>
                <button
                    onClick={fetchCards}
                    className="btn-primary flex items-center gap-2"
                >
                    <RefreshCw size={18} /> Refresh
                </button>
            </div>
        );
    }

    const currentCard = queue[currentCardIndex];

    return (
        <div className="drill-page">
            <div className="drill-controls card-panel">
                <div className="control-group">
                    <div className="control">
                        <label>Cards</label>
                        <input
                            type="number"
                            min="1"
                            max="50"
                            value={limit}
                            onChange={(e) => {
                                const next = Math.min(Math.max(parseInt(e.target.value || '1', 10), 1), 50);
                                setLimit(next);
                            }}
                            className="input-premium"
                        />
                    </div>
                    <div className="control">
                        <label>Type</label>
                        <select
                            value={cardType}
                            onChange={(e) => setCardType(e.target.value)}
                            className="select-premium"
                        >
                            <option value="ALL">All Types</option>
                            <option value="CLOZE">Cloze</option>
                            <option value="MCQ">Multiple Choice</option>
                        </select>
                    </div>
                </div>

                <div className="control-group">
                    <div className="control toggle-control">
                        <label>Include New</label>
                        <button
                            className={`toggle-switch ${includeNew ? 'active' : ''}`}
                            onClick={() => setIncludeNew((v) => !v)}
                            type="button"
                        >
                            <div className="toggle-handle" />
                        </button>
                    </div>

                    <button onClick={fetchCards} className="btn-icon-primary" disabled={loading} title="Refresh Queue">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {currentCard && (
                <Card
                    card={currentCard}
                    onAnswer={handleAnswer}
                />
            )}

            <div className="queue-status">
                Card {currentCardIndex + 1} of {queue.length}
            </div>

            <style>{`
        .drill-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
          min-height: 100%;
          position: relative;
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
        }
        
        .drill-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md) var(--spacing-lg);
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }

        .control-group {
            display: flex;
            gap: var(--spacing-lg);
            align-items: center;
        }

        .control {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .control label {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .input-premium,
        .select-premium {
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 0.9rem;
          outline: none;
          transition: all var(--transition-fast);
          min-width: 80px;
        }

        .select-premium {
            min-width: 140px;
            cursor: pointer;
        }

        .input-premium:focus,
        .select-premium:focus {
          border-color: var(--color-primary);
          background: rgba(0, 0, 0, 0.4);
        }

        .toggle-control {
            align-items: center;
        }

        .toggle-switch {
            width: 48px;
            height: 26px;
            background: var(--bg-app);
            border: 1px solid var(--border-color);
            border-radius: 13px;
            position: relative;
            cursor: pointer;
            transition: all var(--transition-fast);
        }

        .toggle-switch.active {
            background: var(--color-primary);
            border-color: var(--color-primary);
        }

        .toggle-handle {
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            position: absolute;
            top: 2px;
            left: 2px;
            transition: transform var(--transition-fast);
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        .toggle-switch.active .toggle-handle {
            transform: translateX(22px);
        }

        .btn-icon-primary {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--color-primary);
            color: white;
            border-radius: var(--radius-md);
            transition: all var(--transition-fast);
            box-shadow: var(--shadow-sm);
        }

        .btn-icon-primary:hover:not(:disabled) {
            background: var(--color-primary-hover);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }

        .btn-icon-primary:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }

        .queue-status {
          position: absolute;
          bottom: -30px;
          right: 0;
          color: var(--text-muted);
          font-size: 0.875rem;
          font-family: monospace;
        }
        
        .btn-primary {
          padding: 12px 24px;
          background: var(--color-primary);
          color: white;
          border-radius: var(--radius-md);
          font-weight: 600;
          transition: all var(--transition-fast);
        }
        
        .btn-primary:hover {
          background: var(--color-primary-hover);
        }
      `}</style>
        </div>
    );
};

export default Drill;
