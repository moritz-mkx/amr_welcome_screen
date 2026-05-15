import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DisplayView from './components/Display/Slideshow';
import AdminPanel from './components/Admin/AdminPanel';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/display" element={<DisplayView />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/" element={<DisplayView />} />
      </Routes>
    </Router>
  );
}

export default App;
