import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useSyllabus } from '../contexts/SyllabusContext';
import { Trash2, Edit2, Save, X, Search, BookOpen } from 'lucide-react';
import '../styles/global.css';

const Library = () => {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [editingCard, setEditingCard] = useState(null);
    const [filterUnit, setFilterUnit] = useState('');
    const { syllabusList, getUnitTitle } = useSyllabus();

    const fetchCards = async (reset = false) => {
        if (loading) return;
        setLoading(true);
        try {
            const offset = reset ? 0 : page * 50;
            const res = await client.get('/cards', {
                params: { offset, limit: 50, syllabus_ref: filterUnit || undefined }
            });

            if (reset) {
                setCards(res.data);
                setPage(1);
            } else {
                setCards(prev => [...prev, ...res.data]);
                setPage(prev => prev + 1);
            }

            if (res.data.length < 50) setHasMore(false);
            else setHasMore(true);
        } catch (err) {
            console.error('Failed to fetch cards', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCards(true);
    }, [filterUnit]);

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this card?')) return;
        try {
            await client.delete(`/cards/${id}`);
            setCards(prev => prev.filter(c => c.card_id !== id));
        } catch (err) {
            console.error('Failed to delete card', err);
            alert('Failed to delete card');
        }
    };

    const handleUpdate = async (card) => {
        try {
            const res = await client.put(`/cards/${card.card_id}`, card);
            setCards(prev => prev.map(c => c.card_id === card.card_id ? res.data : c));
            setEditingCard(null);
        } catch (err) {
            console.error('Failed to update card', err);
            alert('Failed to update card');
        }
    };

    return (
        <div className="library-page">
            <header className="library-header">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BookOpen size={24} /> Library
                </h1>
                <div className="filter-container">
                    <select
                        value={filterUnit}
                        onChange={(e) => setFilterUnit(e.target.value)}
                        className="unit-select"
                    >
                        <option value="">All Units</option>
                        {syllabusList.map(unit => (
                            <option key={unit.id} value={unit.id}>
                                {unit.title}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            <div className="cards-grid">
                {cards.map(card => (
                    <div key={card.card_id} className="card-item card-panel">
                        {editingCard?.card_id === card.card_id ? (
                            <EditForm
                                card={editingCard}
                                onSave={handleUpdate}
                                onCancel={() => setEditingCard(null)}
                            />
                        ) : (
                            <>
                                <div className="card-meta">
                                    <span className="unit-badge" title={card.syllabus_ref}>
                                        {getUnitTitle(card.syllabus_ref)}
                                    </span>
                                    <div className="card-actions">
                                        <button onClick={() => setEditingCard(card)} className="action-btn edit">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(card.card_id)} className="action-btn delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="card-content">
                                    <p className="question-text">{card.question}</p>
                                    <div className="answer-preview">
                                        <strong>Answer:</strong> {card.cloze_part}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            {hasMore && (
                <button onClick={() => fetchCards(false)} className="load-more-btn" disabled={loading}>
                    {loading ? 'Loading...' : 'Load More'}
                </button>
            )}

            <style>{`
        .library-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
          max-width: 1000px;
          margin: 0 auto;
        }
        
        .library-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
        }
        
        .unit-select {
          min-width: 200px;
        }
        
        .cards-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--spacing-md);
        }
        
        .card-item {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }
        
        .card-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .unit-badge {
          font-size: 0.75rem;
          color: var(--text-secondary);
          background: var(--bg-app);
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
        }
        
        .card-actions {
          display: flex;
          gap: var(--spacing-sm);
        }
        
        .action-btn {
          padding: 6px;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          transition: all var(--transition-fast);
        }
        
        .action-btn:hover {
          background: var(--bg-app);
          color: var(--text-primary);
        }
        
        .action-btn.delete:hover {
          color: var(--color-danger);
        }
        
        .question-text {
          font-size: 1.1rem;
          font-weight: 500;
          margin-bottom: var(--spacing-sm);
        }
        
        .answer-preview {
          font-size: 0.9rem;
          color: var(--text-secondary);
          padding: var(--spacing-sm);
          background: var(--bg-app);
          border-radius: var(--radius-sm);
        }
        
        .load-more-btn {
          padding: var(--spacing-md);
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-weight: 500;
          transition: all var(--transition-fast);
        }
        
        .load-more-btn:hover:not(:disabled) {
          background: var(--bg-surface-hover);
          color: var(--text-primary);
        }
        
        /* Edit Form Styles */
        .edit-form {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }
        
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-sm);
        }
      `}</style>
        </div>
    );
};

const EditForm = ({ card, onSave, onCancel }) => {
    const [formData, setFormData] = useState({ ...card });

    return (
        <div className="edit-form">
            <div className="form-group">
                <label className="text-sm text-muted">Question</label>
                <textarea
                    value={formData.question}
                    onChange={e => setFormData({ ...formData, question: e.target.value })}
                    rows={3}
                    className="w-full"
                />
            </div>
            <div className="form-group">
                <label className="text-sm text-muted">Answer (Cloze Part)</label>
                <input
                    type="text"
                    value={formData.cloze_part}
                    onChange={e => setFormData({ ...formData, cloze_part: e.target.value })}
                    className="w-full"
                />
            </div>
            <div className="form-actions">
                <button onClick={onCancel} className="btn-secondary p-2 rounded hover:bg-app">
                    <X size={18} />
                </button>
                <button onClick={() => onSave(formData)} className="btn-primary p-2 rounded flex items-center gap-2">
                    <Save size={18} /> Save
                </button>
            </div>
        </div>
    );
};

export default Library;
