import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import ImageUpload from './components/ImageUpload';
import Analytics from './pages/Analytics';
import LiveCamera from './pages/LiveCamera';
import AlertCenter from './pages/AlertCenter';
import AlertRules from './pages/AlertRules';

import CameraMonitoring from './pages/CameraMonitoring';

import CameraManagement from './pages/CameraManagement';
import MultiCameraView from './pages/MultiCameraView';
import TelegramConnect from './pages/TelegramConnect';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#020617]">
        <Navigation />

        <div className="pt-4">
          <Routes>
            <Route path="/" element={<Navigate to="/live" replace />} />

            <Route path="/live" element={<LiveCamera />} />
            <Route path="/alerts" element={<AlertCenter />} />
            <Route path="/rules" element={<AlertRules />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/monitor" element={<CameraMonitoring />} />
            <Route path="/cameras" element={<CameraManagement />} />
            <Route path="/grid" element={<MultiCameraView />} />
            <Route path="/telegram" element={<TelegramConnect />} />

            <Route path="/upload" element={<ImageUpload />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
