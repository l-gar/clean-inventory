import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import AddItem from './pages/AddItem'
import InventoryList from './pages/InventoryList'
import Alerts from './pages/Alerts'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/add" replace />} />
        <Route path="add" element={<AddItem />} />
        <Route path="inventory" element={<InventoryList />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
