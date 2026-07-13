import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingProps {
  setUserGoal: (goal: number) => void;
}

const popularGoals = [1800, 2000, 2200, 2500];

export const Onboarding = ({ setUserGoal }: OnboardingProps) => {
  const [goal, setGoal] = useState(2000);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal <= 0) {
      setError("L'objectif doit être supérieur à 0");
      return;
    }
    setError(null);
    if (step === 0) {
      setStep(1);
      return;
    }
    setUserGoal(goal);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-blue-400/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-indigo-400/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="relative w-full max-w-lg"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-10 border border-white/20">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }} className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.121-.659-1.172-.879-1.172-2.303 0-3.182C10.55 7.48 11.525 7.184 12.5 7.184c.475 0 .95.098 1.414.293M12 2a3 3 0 0 1 3 3v1m0 0a3 3 0 0 1 3 3v1m0 0a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3Z" />
                    </svg>
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                    CalorieTracker
                  </h1>
                  <p className="text-gray-500 text-base">
                    Suivez vos calories simplement. Atteignez vos objectifs.
                  </p>
                </motion.div>

                <motion.form
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Quel est votre objectif quotidien ?
                    </label>
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1.5">
                      <input
                        type="number"
                        min="1"
                        value={goal}
                        onChange={(e) => { setGoal(parseInt(e.target.value) || 0); setError(null); }}
                        className="flex-1 px-4 py-2.5 bg-white border-0 rounded-lg text-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                      <span className="pr-3 text-sm font-medium text-gray-400">kcal/jour</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {popularGoals.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => { setGoal(g); setError(null); }}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 ${
                            goal === g
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 text-sm text-red-500"
                      >
                        {error}
                      </motion.p>
                    )}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200"
                  >
                    Commencer
                  </motion.button>
                </motion.form>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Objectif défini !</h2>
                <p className="text-gray-500 mb-2">
                  Vous consommez <strong className="text-gray-800">{goal} kcal</strong> par jour
                </p>
                <div className="w-16 h-1 bg-blue-500 rounded-full mx-auto mb-8" />
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200"
                >
                  C'est parti !
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
