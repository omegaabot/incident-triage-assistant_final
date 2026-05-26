import { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import TriagePage from './pages/TriagePage';
import PlaybookPage from './pages/PlaybookPage';
import RulesPage from './pages/RulesPage';
import HistoryPage from './pages/HistoryPage';
import './App.css';

const PAGES = {
  dashboard: Dashboard,
  triage: TriagePage,
  playbook: PlaybookPage,
  rules: RulesPage,
  history: HistoryPage,
};

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [triageHistory, setTriageHistory] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const addToHistory = useCallback((result) => {
    setTriageHistory((prev) => [result, ...prev].slice(0, 50));
  }, []);

  const navigateTo = useCallback((page) => {
    setActivePage(page);
  }, []);

  const PageComponent = PAGES[activePage] || Dashboard;

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        activePage={activePage}
        onNavigate={navigateTo}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        historyCount={triageHistory.length}
      />
      <main className="app-main">
        <PageComponent
          triageHistory={triageHistory}
          addToHistory={addToHistory}
          onNavigate={navigateTo}
        />
      </main>
    </div>
  );
}
