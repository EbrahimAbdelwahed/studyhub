import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import '../styles/global.css';

const GeneratorHistory = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchJobs = () => {
        client.get('/generator/jobs')
            .then(res => setJobs(res.data))
            .catch(err => console.error("Failed to fetch jobs", err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchJobs();
        const interval = setInterval(() => {
            // Poll if there are running jobs
            setJobs(currentJobs => {
                const hasRunning = currentJobs.some(j => j.status === 'RUNNING');
                if (hasRunning) fetchJobs();
                return currentJobs;
            });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'COMPLETED': return 'text-green-500';
            case 'FAILED': return 'text-red-500';
            case 'RUNNING': return 'text-blue-500';
            default: return 'text-muted';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'COMPLETED': return <CheckCircle size={18} />;
            case 'FAILED': return <XCircle size={18} />;
            case 'RUNNING': return <Loader2 size={18} className="animate-spin" />;
            default: return <Clock size={18} />;
        }
    };

    return (
        <div className="history-page">
            <header className="mb-8">
                <h1 className="text-2xl font-bold">Generator History</h1>
                <p className="text-muted">Track your content generation jobs</p>
            </header>

            <div className="jobs-list card-panel">
                {loading && jobs.length === 0 ? (
                    <div className="p-8 text-center text-muted">Loading history...</div>
                ) : jobs.length === 0 ? (
                    <div className="p-8 text-center text-muted">No generation history found.</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 text-muted text-sm">
                                <th className="p-4">Status</th>
                                <th className="p-4">Model</th>
                                <th className="p-4">Cards</th>
                                <th className="p-4">Duplicates</th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Tags</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map(job => (
                                <tr key={job.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className={`flex items-center gap-2 font-medium ${getStatusColor(job.status)}`}>
                                            {getStatusIcon(job.status)}
                                            {job.status}
                                        </div>
                                        {job.error && <div className="text-xs text-red-400 mt-1">{job.error}</div>}
                                    </td>
                                    <td className="p-4 font-mono text-sm opacity-80">{job.model}</td>
                                    <td className="p-4 font-bold">{job.num_cards}</td>
                                    <td className="p-4">
                                        {(job.payload?.skipped_duplicates ?? 0) > 0 ? (
                                            <span className="px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-bold border border-yellow-500/20">
                                                {job.payload.skipped_duplicates} Skipped
                                            </span>
                                        ) : (
                                            <span className="text-muted text-sm">-</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-muted text-sm">
                                        {new Date(job.created_at).toLocaleString()}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {job.requested_tags?.map(tag => (
                                                <span key={tag} className="px-2 py-0.5 rounded bg-white/5 text-xs text-muted border border-white/10">
                                                    {tag}
                                                </span>
                                            )) || <span className="text-muted text-sm">-</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <style>{`
                .history-page {
                    max-width: 1000px;
                    margin: 0 auto;
                }
                .jobs-list {
                    background: var(--bg-surface);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                }
            `}</style>
        </div>
    );
};

export default GeneratorHistory;
