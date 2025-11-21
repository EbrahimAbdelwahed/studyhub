import React, { useState, useEffect } from 'react';
import client from '../api/client';
import ErrorTaxonomyChart from '../components/ErrorTaxonomyChart';
import { Loader2 } from 'lucide-react';
import '../styles/global.css';

const Forensics = () => {
    const [errorData, setErrorData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        client.get('/analytics/error-taxonomy')
            .then(res => setErrorData(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin" size={48} color="var(--color-primary)" />
            </div>
        );
    }

    return (
        <div className="forensics-page">
            <header>
                <h1 className="text-2xl font-bold">Forensics</h1>
                <p className="text-muted">Detailed error analysis and diagnostics</p>
            </header>

            <div className="card-panel">
                <h2>Error Taxonomy</h2>
                <p className="text-muted mb-4">Breakdown of errors by competency tag. Focus on areas with high error rates.</p>
                <div style={{ height: 600 }}>
                    <ErrorTaxonomyChart data={errorData} />
                </div>
            </div>

            <style>{`
        .forensics-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
        }
        
        .card-panel {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
        }
        
        .card-panel h2 {
          font-size: 1.25rem;
          margin-bottom: var(--spacing-xs);
          color: var(--text-primary);
        }
        
        .mb-4 { margin-bottom: 1rem; }
      `}</style>
        </div>
    );
};

export default Forensics;
