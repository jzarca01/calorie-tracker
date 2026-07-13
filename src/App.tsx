import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Onboarding } from './components/Onboarding';
import { MealLog } from './components/MealLog';
import { Recipes } from './components/Recipes';
import { History } from './components/History';
import { Settings } from './components/Settings';
import { useAuth } from './hooks/useAuth';

const navItems = [
  { to: '/log', label: 'Journal', icon: '📊' },
  { to: '/recipes', label: 'Recettes', icon: '📖' },
  { to: '/history', label: 'Historique', icon: '📅' },
  { to: '/settings', label: 'Réglages', icon: '⚙️' },
];

export const App = () => {
  const { userGoal, setUserGoal } = useAuth();

  if (!userGoal) {
    return (
      <BrowserRouter basename="/calorie-tracker">
        <Routes>
          <Route path="/" element={<Onboarding setUserGoal={setUserGoal} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter basename="/calorie-tracker">
      <div className="min-h-screen bg-gray-50/80 pb-20 md:pb-0">
        {/* Desktop Navigation */}
        <nav className="hidden md:flex sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/80">
          <div className="max-w-7xl mx-auto w-full px-6 lg:px-8 flex items-center justify-between h-16">
            <NavLink to="/log" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.121-.659-1.172-.879-1.172-2.303 0-3.182C10.55 7.48 11.525 7.184 12.5 7.184c.475 0 .95.098 1.414.293M12 2a3 3 0 0 1 3 3v1m0 0a3 3 0 0 1 3 3v1m0 0a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3Z" />
                </svg>
              </div>
              <span className="text-base font-bold text-gray-900 tracking-tight">CalTracker</span>
            </NavLink>
            <div className="flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/log" element={<MealLog />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/log" replace />} />
        </Routes>

        {/* Mobile Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
          <div className="bg-white/90 backdrop-blur-xl border-t border-gray-200/80 px-2 py-1">
            <div className="flex items-center justify-around max-w-lg mx-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'text-blue-600 scale-105'
                        : 'text-gray-400 hover:text-gray-600'
                    }`
                  }
                >
                  <span className="text-xl leading-none">{item.icon}</span>
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </BrowserRouter>
  );
};

export default App;
