import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './components/home/HomePage';
import WorkflowBuilder from './components/builder/WorkflowBuilder';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:projectName" element={<WorkflowBuilder />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
