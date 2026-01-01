import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import ImageUpload from './components/ImageUpload';
import Analytics from './pages/Analytics';
import LiveCamera from './pages/LiveCamera';
import AlertCenter from './pages/AlertCenter'; // Added
import AlertRules from './pages/AlertRules';  

import  StoreTest from './pages/StoreTest';
import CameraMonitoring from'./pages/CameraMonitoring';

// In routes:

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#020617]">
        <Navigation />
        
        {/* Main Content Area */}
        <div className="pt-4"> 
          <Routes>
            {/* Redirect root to Live Camera for a "Security Dashboard" feel */}
            <Route path="/" element={<Navigate to="/live" replace />} />
            
            <Route path="/live" element={<LiveCamera />} />
            <Route path="/alerts" element={<AlertCenter />} />
            <Route path="/rules" element={<AlertRules />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/monitor" element={<CameraMonitoring />} />

          
                         
            <Route path="/store-test" element={<StoreTest />}/>
            
            {/* Keep ImageUpload as a manual tool for static analysis */}
            <Route path="/upload" element={<ImageUpload />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;