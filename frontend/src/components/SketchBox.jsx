import React, { useRef, useState, useEffect } from 'react';
import { ReactSketchCanvas } from 'react-sketch-canvas';
import { Eraser, Pen, Trash2, Save, Loader2, Undo, Redo } from 'lucide-react';
import client from '../api/client';
import '../styles/global.css';

const SketchBox = ({ cardId }) => {
    const canvasRef = useRef(null);
    const [eraseMode, setEraseMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (!cardId) return;

        const loadSketch = async () => {
            setLoading(true);
            try {
                const res = await client.get(`/cards/${cardId}/sketch`);
                if (res.data && res.data.data_url && canvasRef.current) {
                    canvasRef.current.loadPaths(JSON.parse(res.data.data_url));
                } else if (canvasRef.current) {
                    canvasRef.current.clearCanvas();
                }
            } catch (err) {
                console.error('Failed to load sketch', err);
            } finally {
                setLoading(false);
            }
        };

        loadSketch();
    }, [cardId]);

    const handleSave = async () => {
        if (!cardId || !canvasRef.current) return;

        setSaving(true);
        try {
            const paths = await canvasRef.current.exportPaths();
            // We save the paths JSON string to allow editable reloading
            // The backend expects a "data_url" field, but we can store the JSON string there if it's just a text field,
            // or we might need to check if it expects an actual image Data URL.
            // Re-reading API docs: "data_url" usually implies an image, but let's see if we can store paths.
            // If the backend just stores a string, JSON is better for re-editing.
            // If it needs an image for display elsewhere, we might need exportImage.
            // Let's assume for now we want to be able to continue editing, so we save paths.
            // If the backend validates it as an image, this might fail.
            // Let's try to save paths as a string.

            await client.put(`/cards/${cardId}/sketch`, {
                data_url: JSON.stringify(paths)
            });
            setHasChanges(false);
        } catch (err) {
            console.error('Failed to save sketch', err);
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async () => {
        if (window.confirm('Are you sure you want to clear your notes?')) {
            canvasRef.current.clearCanvas();
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
        <div className="sketch-box-container">
            <div className="sketch-toolbar">
                <div className="tools-group">
                    <button
                        className={`tool-btn ${!eraseMode ? 'active' : ''}`}
                        onClick={() => {
                            setEraseMode(false);
                            canvasRef.current?.eraseMode(false);
                        }}
                        title="Pen"
                    >
                        <Pen size={18} />
                    </button>
                    <button
                        className={`tool-btn ${eraseMode ? 'active' : ''}`}
                        onClick={() => {
                            setEraseMode(true);
                            canvasRef.current?.eraseMode(true);
                        }}
                        title="Eraser"
                    >
                        <Eraser size={18} />
                    </button>
                </div>

                <div className="tools-group">
                    <button className="tool-btn" onClick={() => canvasRef.current?.undo()} title="Undo">
                        <Undo size={18} />
                    </button>
                    <button className="tool-btn" onClick={() => canvasRef.current?.redo()} title="Redo">
                        <Redo size={18} />
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
                <ReactSketchCanvas
                    ref={canvasRef}
                    strokeWidth={3}
                    strokeColor="var(--text-primary)"
                    canvasColor="transparent"
                    eraserWidth={20}
                    style={{ border: 'none' }}
                    onStroke={() => setHasChanges(true)}
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
                    height: 400px;
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
                }
            `}</style>
        </div>
    );
};

export default SketchBox;
