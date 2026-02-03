import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import Header from './components/Header.jsx'
import MasjidConfig from './components/MasjidConfig.jsx'
import IqamaahTimes from './pages/IqamaahTimes.jsx'
import PageManagement from './pages/PageManagement.jsx'
import PlaceholderPage from './pages/PlaceholderPage.jsx'

function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/masjid-config" replace />} />
          <Route path="/masjid-config" element={<MasjidConfig />} />
          <Route path="/iqamaah-times" element={<IqamaahTimes />} />
          <Route path="/page-management" element={<PageManagement />} />
          <Route path="/coming-soon" element={<PlaceholderPage />} />
          <Route path="*" element={<Navigate to="/masjid-config" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
