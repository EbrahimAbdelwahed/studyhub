import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Drill from './pages/Drill';
import Forensics from './pages/Forensics';
import Syllabus from './pages/Syllabus';
import Generator from './pages/Generator';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/drill" element={<Drill />} />
        <Route path="/forensics" element={<Forensics />} />
        <Route path="/syllabus" element={<Syllabus />} />
        <Route path="/generator" element={<Generator />} />
      </Routes>
    </Layout>
  );
}

export default App;
