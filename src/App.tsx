import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import TrajViewer from './components/traj-viewer'
import TraceList from './components/TraceList'

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/trace/:traceId" element={<TrajViewer />} />
        <Route path="/" element={<TraceList />} />
      </Routes>
    </Router>
  )
}

export default App