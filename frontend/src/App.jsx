import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Drill from './pages/Drill';
import Forensics from './pages/Forensics';
import Syllabus from './pages/Syllabus';
import Generator from './pages/Generator';
import Library from './pages/Library';
import { SyllabusProvider } from './contexts/SyllabusContext';

const App = () => {
  return (
    <SyllabusProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/drill" element={<Drill />} />
          <Route path="/forensics" element={<Forensics />} />
          <Route path="/syllabus" element={<Syllabus />} />
          <Route path="/generator" element={<Generator />} />
          <Route path="/library" element={<Library />} />
        </Routes>
      </Layout>
    </SyllabusProvider>
  );
};

export default App;
