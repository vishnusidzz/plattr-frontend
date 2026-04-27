import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import BecomeCaterer from './pages/BecomeCaterer'; // 🆕 import
// ...your other imports

<Router>
  <Routes>
    {/* existing routes */}
    <Route path="/become-a-caterer" element={<BecomeCaterer />} /> {/* 🆕 */}
  </Routes>
</Router>