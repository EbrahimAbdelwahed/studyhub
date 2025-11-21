import React, { useState, useEffect } from 'react';
import client from '../api/client';
import Heatmap from '../components/Heatmap';
import VelocityChart from '../components/VelocityChart';
import ErrorTaxonomyChart from '../components/ErrorTaxonomyChart';
import { Loader2 } from 'lucide-react';
import '../styles/global.css';

const Dashboard = () => {
    const [heatmapData, setHeatmapData] = useState([]);
    const [velocityData, setVelocityData] = useState([]);
    const [errorData, setErrorData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [heatmapRes, velocityRes, errorRes] = await Promise.all([
                    client.get('/analytics/heatmap'),
                    client.get('/analytics/velocity'),
                    client.get('/analytics/error-taxonomy')
                ]);
                setHeatmapData(heatmapRes.data);
                setVelocityData(velocityRes.data);
                setErrorData(errorRes.data);
            } catch (err) {
                console.error('Failed to fetch dashboard data', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin" size={48} color="var(--color-primary)" />
            </div>
        );
    }

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted">Overview of your progress</p>
            </header>

            <div className="dashboard-grid">
                <div className="card-panel velocity-panel">
                    <h2>Velocity</h2>
                    <VelocityChart data={velocityData} />
                </div>

                <div className="card-panel error-panel">
                    <h2>Error Taxonomy</h2>
                    <ErrorTaxonomyChart data={errorData} />
                </div>

                <div className="card-panel heatmap-panel">
                    <h2>Syllabus Heatmap</h2>
                    <Heatmap data={heatmapData} />
                </div>
            </div>

            <style>{`
        .dashboard {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
          padding-bottom: var(--spacing-xl);
        }
        
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-lg);
        }
        
        .heatmap-panel {
          grid-column: span 2;
        }
        
        .card-panel {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
        }
        
        .card-panel h2 {
          font-size: 1.25rem;
          margin-bottom: var(--spacing-md);
          color: var(--text-primary);
        }

        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
          .heatmap-panel {
            grid-column: span 1;
          }
        }
      `}</style>
        </div>
    );
};

export default Dashboard;
