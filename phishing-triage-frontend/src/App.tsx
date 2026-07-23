import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import UploadPage from './pages/UploadPage';
import ResultPage from './pages/ResultPage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/result/:id" element={<ResultPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </>
  );
}
