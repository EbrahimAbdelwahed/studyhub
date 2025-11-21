import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import Card from '../components/Card';
import { Loader2, RefreshCw } from 'lucide-react';
import '../styles/global.css';

const Drill = () => {
    const [queue, setQueue] = useState([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchCards = useCallback(async () => {
        setLoading(true);
        try {
            const res = await client.get('/cards/next?limit=10');
            // Filter out duplicates if appending, but for now let's just replace if empty
            // or append if we want continuous flow.
            // The spec says "buffer continuo".
            // Let's just replace the queue if it's empty, otherwise append?
            // Simpler: If queue is empty, set it.
            setQueue(res.data);
            setCurrentCardIndex(0);
        } catch (err) {
            console.error('Failed to fetch cards', err);
        } finally {
            setLoading(false);
        }
    }, []);

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
          align-items: center;
          justify-content: center;
          height: 100%;
          position: relative;
        }
        
        .queue-status {
          position: absolute;
          bottom: 0;
          right: 0;
          color: var(--text-muted);
          font-size: 0.875rem;
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
