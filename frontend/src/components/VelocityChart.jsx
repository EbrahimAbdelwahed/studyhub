import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const VelocityChart = ({ data }) => {
    if (!data || data.length === 0) return <div className="no-data">No data available</div>;

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} opacity={0.5} />
                    <XAxis
                        dataKey="date"
                        stroke="var(--text-muted)"
                        tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                    />
                    <YAxis
                        stroke="var(--text-muted)"
                        tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        dx={-10}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            boxShadow: 'var(--shadow-lg)'
                        }}
                        itemStyle={{ color: 'var(--color-primary)' }}
                        cursor={{ stroke: 'var(--border-color)', strokeWidth: 1 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="cards_processed"
                        stroke="var(--color-primary)"
                        strokeWidth={3}
                        dot={{ fill: 'var(--bg-app)', stroke: 'var(--color-primary)', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: 'var(--color-primary)', stroke: 'var(--bg-app)', strokeWidth: 2 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default VelocityChart;
