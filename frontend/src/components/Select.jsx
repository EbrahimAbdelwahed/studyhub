import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import '../styles/global.css';

const Select = ({ value, onChange, options, label, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`custom-select-container ${className}`} ref={containerRef}>
            {label && <label className="select-label">{label}</label>}
            <button
                type="button"
                className={`select-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="selected-value">{selectedOption?.label}</span>
                <ChevronDown
                    size={16}
                    className={`chevron ${isOpen ? 'rotate' : ''}`}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="select-dropdown"
                    >
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`select-option ${value === option.value ? 'selected' : ''}`}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                            >
                                <span>{option.label}</span>
                                {value === option.value && <Check size={14} className="check-icon" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .custom-select-container {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    min-width: 160px;
                }

                .select-label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-left: 2px;
                }

                .select-trigger {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    padding: 10px 14px;
                    background: rgba(30, 41, 59, 0.6);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    backdrop-filter: blur(8px);
                }

                .select-trigger:hover {
                    background: rgba(30, 41, 59, 0.8);
                    border-color: var(--text-muted);
                }

                .select-trigger.open {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 1px var(--color-primary);
                    background: rgba(30, 41, 59, 0.9);
                }

                .chevron {
                    color: var(--text-muted);
                    transition: transform 0.2s ease;
                }

                .chevron.rotate {
                    transform: rotate(180deg);
                    color: var(--color-primary);
                }

                .select-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    margin-top: 6px;
                    background: #1e293b;
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    padding: 4px;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
                    z-index: 50;
                    overflow: hidden;
                }

                .select-option {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    padding: 8px 12px;
                    text-align: left;
                    background: transparent;
                    border: none;
                    border-radius: var(--radius-sm);
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .select-option:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: var(--text-primary);
                }

                .select-option.selected {
                    background: rgba(124, 58, 237, 0.1);
                    color: var(--color-primary);
                    font-weight: 600;
                }

                .check-icon {
                    color: var(--color-primary);
                }
            `}</style>
        </div>
    );
};

export default Select;
