import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { motion } from 'framer-motion';
import { ChevronRight, Eye, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import '../styles/global.css';

const Quiz = () => {
    const [quizData, setQuizData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showSolution, setShowSolution] = useState(false);
    const [quizStarted, setQuizStarted] = useState(false);

    const fetchQuiz = async () => {
        setLoading(true);
        setError(null);
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await axios.get(`${API_URL}/api/quiz/generate`);
            setQuizData(response.data);
            setCurrentIndex(0);
            setShowSolution(false);
            setQuizStarted(true);
        } catch (err) {
            console.error("Error fetching quiz:", err);
            setError("Failed to load quiz. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (currentIndex < quizData.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setShowSolution(false);
        } else {
            // End of quiz
            alert("Quiz Completed!");
            setQuizStarted(false);
        }
    };

    if (!quizStarted) {
        return (
            <div className="p-8 max-w-4xl mx-auto text-center flex flex-col items-center justify-center min-h-[60vh]">
                <h1 className="text-3xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Physics One-Shot Quiz</h1>
                <p className="mb-8 text-lg" style={{ color: 'var(--text-secondary)' }}>
                    20 balanced exercises selected from the book. <br />
                    Topics: Fluids, Mechanics, Units, Thermodynamics, Electricity, Waves.
                </p>

                {loading ? (
                    <div className="flex justify-center items-center gap-2" style={{ color: 'var(--color-primary)' }}>
                        <RefreshCw className="animate-spin" /> Generating Quiz...
                    </div>
                ) : (
                    <button
                        onClick={fetchQuiz}
                        className="btn-primary flex items-center gap-2 mx-auto text-lg"
                    >
                        Start Quiz
                    </button>
                )}

                {error && (
                    <div className="mt-4 p-4 rounded-lg flex items-center justify-center gap-2" style={{ background: 'rgba(248, 113, 113, 0.1)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
                        <AlertCircle size={20} /> {error}
                    </div>
                )}
            </div>
        );
    }

    const currentProblem = quizData[currentIndex];

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Problem {currentIndex + 1} / {quizData.length}
                </h2>
                <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                    {currentProblem.topic} (Diff: {currentProblem.difficulty})
                </span>
            </div>

            <motion.div
                key={currentProblem.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-panel mb-8"
            >
                <div className="text-lg leading-relaxed mb-6 markdown-body" style={{ color: 'var(--text-primary)' }}>
                    <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                    >
                        {currentProblem.text}
                    </ReactMarkdown>
                </div>

                {currentProblem.options && currentProblem.options.length > 0 && (
                    <div className="grid gap-3 mb-6">
                        {currentProblem.options.map((opt, idx) => (
                            <button
                                key={idx}
                                className="text-left p-4 rounded-lg border transition-all hover:shadow-md flex items-start gap-3"
                                style={{
                                    background: 'var(--bg-surface)',
                                    borderColor: 'var(--border-color)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <span className="font-bold min-w-[24px]">{String.fromCharCode(65 + idx)}.</span>
                                <div className="flex-1">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            p: ({ node, ...props }) => <span {...props} /> // Render paragraphs as spans to avoid block layout in button
                                        }}
                                    >
                                        {opt}
                                    </ReactMarkdown>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {showSolution && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-6 p-6 rounded-lg border"
                        style={{
                            background: 'rgba(74, 222, 128, 0.05)',
                            borderColor: 'rgba(74, 222, 128, 0.2)'
                        }}
                    >
                        <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--color-success)' }}>
                            <CheckCircle size={18} /> Solution
                        </h3>
                        <div style={{ color: 'var(--text-primary)' }}>
                            <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                            >
                                {currentProblem.answer || "Solution not available."}
                            </ReactMarkdown>
                        </div>
                        {currentProblem.master_equation && (
                            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(74, 222, 128, 0.1)' }}>
                                <span className="text-sm font-medium block mb-1" style={{ color: 'var(--color-success)' }}>Master Equation:</span>
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                >
                                    {`$${currentProblem.master_equation}$`}
                                </ReactMarkdown>
                            </div>
                        )}
                    </motion.div>
                )}
            </motion.div>

            <div className="flex justify-between items-center">
                <button
                    onClick={() => setShowSolution(!showSolution)}
                    className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    style={{ color: 'var(--color-accent)', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
                >
                    <Eye size={18} /> {showSolution ? "Hide Solution" : "Show Solution"}
                </button>

                <button
                    onClick={handleNext}
                    className="btn-primary flex items-center gap-2"
                >
                    {currentIndex === quizData.length - 1 ? "Finish" : "Next Problem"} <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
};

export default Quiz;
