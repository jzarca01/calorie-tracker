import { useState, useEffect, createContext, useContext } from 'react';

interface AuthContextType {
  userGoal: number | null;
  setUserGoal: (goal: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [userGoal, setUserGoal] = useState<number | null>(() => {
    const savedGoal = localStorage.getItem('userGoal');
    return savedGoal ? parseInt(savedGoal, 10) : null;
  });

  useEffect(() => {
    if (userGoal !== null) {
      localStorage.setItem('userGoal', userGoal.toString());
    } else {
      localStorage.removeItem('userGoal');
    }
  }, [userGoal]);

  return (
    <AuthContext.Provider value={{ userGoal, setUserGoal }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};