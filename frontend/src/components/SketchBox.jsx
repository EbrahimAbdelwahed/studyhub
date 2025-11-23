import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, Pen, Trash2, Save, Loader2, Hand, MousePointer2 } from 'lucide-react';
import client from '../api/client';
import '../styles/global.css';

const SketchBox = ({ cardId }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState('pen'); // 'pen' or 'eraser'
    const [penOnly, setPenOnly] = useState(true);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Drawing state
    const ctxRef = useRef(null);
    const lastPos = useRef({ x: 0, y: 0 });

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d', { desynchronized: true }); // optimize for low latency
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctxRef.current = ctx;

        const resizeCanvas = () => {
            const { width, height } = container.getBoundingClientRect();
            // Save current content
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

            // Resize
            canvas.width = width;
            canvas.height = height;

            // Restore content
            ctx.drawImage(tempCanvas, 0, 0, width, height); // Scale or just draw? Just draw for now.

            // Restore context properties
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    // Load sketch
    useEffect(() => {
        if (!cardId || !ctxRef.current) return;

        const loadSketch = async () => {
            setLoading(true);
            try {
                const res = await client.get(`/cards/${cardId}/sketch`);
                const ctx = ctxRef.current;
                const canvas = canvasRef.current;

                // Clear first
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (res.data && res.data.data_url) {
                    const img = new Image();
                    img.onload = () => {
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.drawImage(img, 0, 0);
                    };
                    img.src = res.data.data_url;
                }
            } catch (err) {
                console.error('Failed to load sketch', err);
            } finally {
                setLoading(false);
            }
        };

        loadSketch();
    }, [cardId]);

    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        if (penOnly && e.pointerType !== 'pen') return;

        e.preventDefault(); // Prevent scrolling/touch actions
        setIsDrawing(true);
        const { x, y } = getPos(e);
        lastPos.current = { x, y };

        // Dot for single click
        draw(e);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        if (penOnly && e.pointerType !== 'pen') return;
        e.preventDefault();

        const ctx = ctxRef.current;
        const { x, y } = getPos(e);

        // Coalesced events for smoother curves
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

        events.forEach(event => {
            const pos = getPos(event);

            ctx.beginPath();
            ctx.moveTo(lastPos.current.x, lastPos.current.y);
            ctx.lineTo(pos.x, pos.y);

            if (tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = 20;
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#e2e8f0'; // var(--text-primary) roughly
            }

            ctx.stroke();
            lastPos.current = pos;
        });
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const handleSave = async () => {
        if (!cardId || !canvasRef.current) return;

        setSaving(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            await client.put(`/cards/${cardId}/sketch`, {
                data_url: dataUrl
            });
        } catch (err) {
            console.error('Failed to save sketch', err);
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async () => {
        if (window.confirm('Clear sketch?')) {
            const ctx = ctxRef.current;
            const canvas = canvasRef.current;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (cardId) {
                try {
                    await client.delete(`/cards/${cardId}/sketch`);
                } catch (err) {
                    console.error('Failed to delete sketch', err);
                }
            }
        }
    };

    return (
        <div className="sketch-box-container" ref={containerRef}>
            <div className="sketch-toolbar">
                <div className="tools-group">
                    <button
                        className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
                        onClick={() => setTool('pen')}
                        title="Pen"
                    >
                        <Pen size={18} />
                    </button>
                    <button
                        className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                        onClick={() => setTool('eraser')}
                        title="Eraser"
                    >
                        <Eraser size={18} />
                    </button>
                </div>

                <div className="tools-group">
                    <button
                        className={`tool-btn ${penOnly ? 'active-subtle' : ''}`}
                        onClick={() => setPenOnly(!penOnly)}
                        title={penOnly ? "Pen Only Mode (Palm Rejection On)" : "Touch Drawing Enabled"}
                    >
                        {penOnly ? <MousePointer2 size={18} /> : <Hand size={18} />}
                        <span className="text-xs ml-2 hidden sm:inline">
                            {penOnly ? "Pen Only" : "Touch & Pen"}
                        </span>
                    </button>
                </div>

                <div className="tools-group ml-auto">
                    <button
                        className="tool-btn text-red-400 hover:bg-red-500/10"
                        onClick={handleClear}
                        title="Clear All"
                    >
                        <Trash2 size={18} />
                    </button>
                    <button
                        className="tool-btn primary"
                        onClick={handleSave}
                        disabled={saving}
                        title="Save Sketch"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    </button>
                </div>
            </div>

            <div className="canvas-wrapper">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                )}
                <canvas
                    ref={canvasRef}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                    style={{ touchAction: 'none', width: '100%', height: '100%' }}
                />
            </div>

            <style>{`
                .sketch-box-container {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    height: 500px;
                    margin-top: var(--spacing-lg);
                }

                .sketch-toolbar {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: rgba(0, 0, 0, 0.2);
                    border-bottom: 1px solid var(--border-color);
                }

                .tools-group {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding-right: var(--spacing-md);
                    border-right: 1px solid var(--border-color);
                }

                .tools-group:last-child {
                    border-right: none;
                    padding-right: 0;
                }

                .tool-btn {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    transition: all var(--transition-fast);
                }

                .tool-btn:hover {
                    background: var(--bg-surface-hover);
                    color: var(--text-primary);
                }

                .tool-btn.active {
                    background: var(--color-primary);
                    color: white;
                }
                
                .tool-btn.active-subtle {
                    background: rgba(124, 58, 237, 0.2);
                    color: var(--color-primary);
                    border: 1px solid var(--color-primary);
                }

                .tool-btn.primary {
                    color: var(--color-primary);
                }
                
                .tool-btn.primary:hover {
                    background: rgba(124, 58, 237, 0.1);
                }

                .canvas-wrapper {
                    flex: 1;
                    position: relative;
                    background-image: radial-gradient(var(--border-color) 1px, transparent 1px);
                    background-size: 20px 20px;
                    cursor: crosshair;
                    overflow: hidden;
                }
            `}</style>
        </div>
    );
};

export default SketchBox;
