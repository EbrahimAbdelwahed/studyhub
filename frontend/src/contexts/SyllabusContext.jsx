import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const SyllabusContext = createContext(null);

export const SyllabusProvider = ({ children }) => {
    const [syllabusMap, setSyllabusMap] = useState({});
    const [syllabusList, setSyllabusList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSyllabus = async () => {
            try {
                const res = await client.get('/syllabus');
                const units = res.data;
                setSyllabusList(units);

                const map = {};
                units.forEach(unit => {
                    map[unit.id] = unit;
                });
                setSyllabusMap(map);
            } catch (err) {
                console.error('Failed to fetch syllabus', err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSyllabus();
    }, []);

    const getUnitTitle = (id) => {
        return syllabusMap[id]?.title || id;
    };

    const getUnit = (id) => {
        return syllabusMap[id];
    };

    return (
        <SyllabusContext.Provider value={{ syllabusMap, syllabusList, getUnitTitle, getUnit, loading, error }}>
            {children}
        </SyllabusContext.Provider>
    );
};

export const useSyllabus = () => {
    const context = useContext(SyllabusContext);
    if (!context) {
        throw new Error('useSyllabus must be used within a SyllabusProvider');
    }
    return context;
};
