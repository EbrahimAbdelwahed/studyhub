import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ArrowRight, AlertTriangle, ChevronRight } from 'lucide-react';
import { useSyllabus } from '../contexts/SyllabusContext';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import '../styles/global.css';

const LatexRenderer = ({ text }) => {
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      // Simple regex to find latex patterns like $...$ or $$...$$
      // This is a basic implementation. For more complex mixing, a parser is better.
      // But for now, let's assume the text might contain LaTeX.
      // Actually, let's try to render the whole string if it contains typical latex delimiters,
      // or just render it as HTML if we trust the source to be sanitized.
      // A safer approach for mixed content:

      const renderText = (content) => {
        // Replace $$...$$ with display math and $...$ with inline math
        // We can use a library like react-latex-next, but we installed katex directly.
        // Let's do a manual split.

        const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
        return parts.map((part, index) => {
          if (part.startsWith('$$') && part.endsWith('$$')) {
            const math = part.slice(2, -2);
            try {
              const html = katex.renderToString(math, { displayMode: true });
              return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
            } catch (e) {
              return <span key={index} className="text-red-500">Error</span>;
            }
          } else if (part.startsWith('$') && part.endsWith('$')) {
            const math = part.slice(1, -1);
            try {
              const html = katex.renderToString(math, { displayMode: false });
              return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
            } catch (e) {
              return <span key={index} className="text-red-500">Error</span>;
            }
          }
          return <span key={index}>{part}</span>;
        });
      };

      // We can't easily return the array from useEffect, so we'll use a state or just render in the component body.
    }
  }, [text]);

  // Simplified render:
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2);
          try {
            const html = katex.renderToString(math, { displayMode: true });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch (e) {
            return <span key={index} className="text-red-500">Error rendering math</span>;
          }
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          try {
            const html = katex.renderToString(math, { displayMode: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch (e) {
            return <span key={index} className="text-red-500">Error rendering math</span>;
          }
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

const Card = ({ card, onAnswer, feedback, onNext }) => {
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState('idle'); // idle, correct, wrong
  const [shake, setShake] = useState(0);
  const { getUnitTitle } = useSyllabus();

  useEffect(() => {
    setAnswer('');
    setStatus('idle');
    setShake(0);
  }, [card]);

  const handleSubmit = () => {
    if (!answer || status !== 'idle') return;

    const normalizedAnswer = answer.trim().toLowerCase();
    const normalizedSolution = (card.cloze_part || '').trim().toLowerCase();
    const isCorrect = normalizedSolution && normalizedAnswer === normalizedSolution;

    if (isCorrect) {
      setStatus('correct');
      setTimeout(() => onAnswer('correct', 20), 1000);
    } else {
      setStatus('wrong');
      setShake(prev => prev + 1);
      // Don't auto-advance for wrong answers, wait for feedback display
      onAnswer('wrong', 20);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const unitTitle = getUnitTitle(card.syllabus_ref) || card.dm418_tag.replace(/_/g, ' ');

  return (
    <div className="card-container">
      <AnimatePresence mode="wait">
        <motion.div
          key={card.card_id}
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: 1,
            y: 0,
            x: status === 'wrong' ? [0, -5, 5, -5, 5, 0] : 0
          }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={`card ${status}`}
        >
          <div className="card-header">
            <span className="tag" title={card.syllabus_ref}>{unitTitle}</span>
            {card.state === 'CRITICAL' && (
              <span className="badge-critical">
                <AlertTriangle size={14} /> Panic Mode
              </span>
            )}
          </div>

          {/* Validation Check for Broken Cards */}
          {card.type === 'MCQ' && !card.cloze_part ? (
            <div className="error-state">
              <AlertTriangle size={48} className="text-red-500 mb-4" />
              <h3 className="text-xl font-bold text-red-500">Card Error</h3>
              <p className="text-muted mt-2">Missing answer key. This card cannot be graded.</p>
              <button
                onClick={() => onAnswer('skip', 0)}
                className="mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors"
              >
                Skip Card
              </button>
            </div>
          ) : (
            <>
              <div className="question">
                <LatexRenderer text={card.question} />
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
                        {option.startsWith('$') ? <LatexRenderer text={option} /> : option}
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

                {feedback && (
                  <button
                    className="next-btn"
                    onClick={onNext}
                  >
                    Next Card <ChevronRight size={18} />
                  </button>
                )}
              </div>
            </>
          )}

          {feedback && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="feedback-wrong"
            >
              <div className="mb-2 font-bold">Feedback:</div>
              <LatexRenderer text={feedback} />
              {card.cloze_part && (
                <div className="mt-2 text-sm text-muted">
                  Correct answer: <strong>{card.cloze_part}</strong>
                </div>
              )}
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
          background: var(--bg-paper);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-2xl);
          width: 100%;
          max-width: 680px;
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
          position: relative;
        }
        
        .card.correct {
          border-color: var(--color-success);
          box-shadow: 6px 6px 0px rgba(74, 222, 128, 0.2);
        }
        
        .card.wrong {
          border-color: var(--color-danger);
          box-shadow: 6px 6px 0px rgba(248, 113, 113, 0.2);
        }
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px dashed var(--border-color);
          padding-bottom: var(--spacing-md);
        }
        
        .tag {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
          background: var(--bg-app);
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
        }
        
        .badge-critical {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--color-danger);
          font-size: 0.75rem;
          font-weight: 600;
          background: rgba(248, 113, 113, 0.1);
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-danger);
        }
        
        .question {
          font-size: 1.5rem;
          font-weight: 500;
          line-height: 1.4;
          color: var(--text-primary);
        }
        
        .cloze-input {
          width: 100%;
          padding: var(--spacing-lg);
          background: var(--bg-app);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 1.25rem;
          outline: none;
          transition: all var(--transition-fast);
          font-family: inherit;
        }
        
        .cloze-input:focus {
          border-color: var(--color-primary);
          box-shadow: var(--shadow-sm);
        }
        
        .mcq-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-md);
        }
        
        .mcq-option {
          padding: var(--spacing-lg);
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 1rem;
          text-align: left;
          transition: all var(--transition-fast);
          font-weight: 500;
          position: relative;
          overflow: hidden;
        }
        
        .mcq-option:hover:not(:disabled) {
          border-color: var(--color-primary);
          color: var(--text-primary);
          background: var(--bg-surface-hover);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        
        .mcq-option.selected {
          background: rgba(124, 58, 237, 0.1);
          border-color: var(--color-primary);
          color: var(--color-primary);
          box-shadow: 0 0 0 1px var(--color-primary);
          font-weight: 600;
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
          padding: 12px 24px;
          background: var(--color-primary);
          color: white;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 1rem;
          transition: all var(--transition-fast);
          box-shadow: var(--shadow-sm);
          border: 1px solid rgba(0,0,0,0.1);
        }
        
        .submit-btn:hover:not(:disabled) {
          background: var(--color-primary-hover);
          transform: translate(-2px, -2px);
          box-shadow: var(--shadow-md);
        }
        
        .submit-btn:active:not(:disabled) {
          transform: translate(0, 0);
          box-shadow: none;
        }
        
        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
          background: var(--text-muted);
        }
        
        .feedback-wrong {
          color: var(--color-danger);
          font-size: 1rem;
          text-align: center;
          background: rgba(248, 113, 113, 0.1);
          padding: var(--spacing-md);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-danger);
        }

        .next-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 24px;
            background: var(--bg-surface);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            font-weight: 600;
            margin-left: var(--spacing-md);
            transition: all var(--transition-fast);
        }

        .next-btn:hover {
            background: var(--bg-surface-hover);
            border-color: var(--color-primary);
        }

        .error-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: var(--spacing-2xl);
            text-align: center;
        }
      `}</style>
    </div>
  );
};

export default Card;
