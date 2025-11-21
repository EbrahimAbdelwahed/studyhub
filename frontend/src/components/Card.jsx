import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ArrowRight, AlertTriangle } from 'lucide-react';
import '../styles/global.css';

const Card = ({ card, onAnswer }) => {
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState('idle'); // idle, correct, wrong
  const [shake, setShake] = useState(0);

  useEffect(() => {
    setAnswer('');
    setStatus('idle');
    setShake(0);
  }, [card]);

  const handleSubmit = () => {
    if (!answer || status !== 'idle') return;

    const isCorrect = answer.trim().toLowerCase() === card.cloze_part.toLowerCase();

    if (isCorrect) {
      setStatus('correct');
      setTimeout(() => onAnswer('correct', 20), 1000);
    } else {
      setStatus('wrong');
      setShake(prev => prev + 1);
      setTimeout(() => {
        onAnswer('wrong', 20);
      }, 1500);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="card-container">
      <AnimatePresence mode="wait">
        <motion.div
          key={card.card_id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            x: status === 'wrong' ? [0, -10, 10, -10, 10, 0] : 0
          }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className={`card ${status}`}
        >
          <div className="card-header">
            <span className="tag">{card.dm418_tag.replace(/_/g, ' ')}</span>
            {card.state === 'CRITICAL' && (
              <span className="badge-critical">
                <AlertTriangle size={14} /> Panic Mode
              </span>
            )}
          </div>

          <div className="question">
            {card.question}
          </div>

          <div className="input-area">
            {card.type === 'CLOZE' ? (
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer..."
                className="cloze-input"
                autoFocus
                disabled={status !== 'idle'}
              />
            ) : (
              <div className="mcq-options">
                {card.mcq_options?.map((option) => (
                  <button
                    key={option}
                    onClick={() => setAnswer(option)}
                    className={`mcq-option ${answer === option ? 'selected' : ''}`}
                    disabled={status !== 'idle'}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="actions">
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={!answer || status !== 'idle'}
            >
              {status === 'idle' ? (
                <>Submit <ArrowRight size={18} /></>
              ) : status === 'correct' ? (
                <>Correct <Check size={18} /></>
              ) : (
                <>Wrong <X size={18} /></>
              )}
            </button>
          </div>

          {status === 'wrong' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="feedback-wrong"
            >
              Correct answer: <strong>{card.cloze_part}</strong>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      <style>{`
        .card-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 60vh;
          width: 100%;
          padding: var(--spacing-lg);
        }
        
        .card {
          background: var(--bg-glass);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-xl);
          padding: var(--spacing-2xl);
          width: 100%;
          max-width: 680px;
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
          position: relative;
          overflow: hidden;
        }
        
        .card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        }
        
        .card.correct {
          border-color: var(--color-success);
          box-shadow: 0 0 40px rgba(74, 222, 128, 0.15);
        }
        
        .card.wrong {
          border-color: var(--color-danger);
          box-shadow: 0 0 40px rgba(248, 113, 113, 0.15);
        }
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .tag {
          font-size: 0.7rem;
          color: var(--color-accent);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
          background: rgba(224, 195, 140, 0.1);
          padding: 6px 12px;
          border-radius: var(--radius-full);
          border: 1px solid rgba(224, 195, 140, 0.2);
        }
        
        .badge-critical {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--color-danger);
          font-size: 0.75rem;
          font-weight: 600;
          background: rgba(248, 113, 113, 0.1);
          padding: 6px 12px;
          border-radius: var(--radius-full);
          border: 1px solid rgba(248, 113, 113, 0.2);
        }
        
        .question {
          font-size: 1.75rem;
          font-weight: 500;
          line-height: 1.3;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }
        
        .cloze-input {
          width: 100%;
          padding: var(--spacing-lg);
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          color: var(--text-primary);
          font-size: 1.5rem;
          outline: none;
          transition: all var(--transition-fast);
          font-family: inherit;
        }
        
        .cloze-input:focus {
          border-color: var(--color-primary);
          background: rgba(0, 0, 0, 0.3);
          box-shadow: 0 0 0 4px rgba(217, 119, 87, 0.1);
        }
        
        .mcq-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-md);
        }
        
        .mcq-option {
          padding: var(--spacing-lg);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          color: var(--text-secondary);
          font-size: 1.125rem;
          text-align: left;
          transition: all var(--transition-fast);
          font-weight: 500;
        }
        
        .mcq-option:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--text-muted);
          color: var(--text-primary);
        }
        
        .mcq-option.selected {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: white;
          box-shadow: var(--shadow-glow);
        }
        
        .actions {
          display: flex;
          justify-content: flex-end;
          padding-top: var(--spacing-md);
        }
        
        .submit-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 32px;
          background: var(--color-primary);
          color: white;
          border-radius: var(--radius-full);
          font-weight: 600;
          font-size: 1.125rem;
          transition: all var(--transition-fast);
          box-shadow: var(--shadow-glow);
        }
        
        .submit-btn:hover:not(:disabled) {
          background: var(--color-primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -5px rgba(217, 119, 87, 0.4);
        }
        
        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        
        .feedback-wrong {
          color: var(--color-danger);
          font-size: 1rem;
          text-align: center;
          background: rgba(248, 113, 113, 0.1);
          padding: var(--spacing-md);
          border-radius: var(--radius-lg);
          border: 1px solid rgba(248, 113, 113, 0.2);
        }
      `}</style>
    </div>
  );
};

export default Card;
