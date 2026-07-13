import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';

export const Settings = () => {
  const { userGoal, setUserGoal } = useAuth();
  const [currentGoal, setCurrentGoal] = useState(userGoal || 0);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentGoal <= 0) {
      setErrorMessage('Veuillez entrer un objectif valide supérieur à 0');
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    setTimeout(() => {
      setUserGoal(currentGoal);
      setIsSaving(false);
      setSuccessMessage('Objectif mis à jour');
      setTimeout(() => setSuccessMessage(null), 3000);
    }, 600);
  };

  return (
    <div>
      <header className="page-header mx-4 mt-4 sm:mx-6 sm:mt-6 lg:mx-8 lg:mt-8">
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Paramètres
              </h1>
              <p className="text-blue-100 text-sm mt-1">Gérez votre profil</p>
            </div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex flex-shrink-0 items-center justify-center">
              <span className="text-2xl">⚙️</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-4 sm:mx-6 lg:mx-8 mt-6">
        <div className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Objectif quotidien</h2>
            <p className="text-sm text-gray-400 mt-0.5">Définissez votre objectif de calories</p>
          </div>

          <div className="px-6 py-6">
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {successMessage}
              </motion.div>
            )}

            {errorMessage && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="daily-goal" className="block text-sm font-medium text-gray-700 mb-2">
                  Objectif de calories
                </label>
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1.5">
                  <input
                    id="daily-goal"
                    type="number"
                    min="1"
                    value={currentGoal}
                    onChange={(e) => setCurrentGoal(parseInt(e.target.value) || 0)}
                    className="flex-1 px-4 py-2.5 bg-white border-0 rounded-lg text-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="2000"
                  />
                  <span className="pr-3 text-sm font-medium text-gray-400">kcal/jour</span>
                </div>
                <p className="mt-1 text-sm text-gray-400 ml-1">
                  Ce chiffre détermine votre progression quotidienne
                </p>
              </div>

              <div className="flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSaving}
                  className="premium-btn-primary"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Sauvegarde...
                    </span>
                  ) : (
                    'Enregistrer'
                  )}
                </motion.button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-gray-100/80 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">À propos</h2>
          </div>
          <div className="px-6 py-6">
            <p className="text-sm text-gray-500 leading-relaxed">
              CalTracker est un tracker minimal et puissant de calories. 
              Scannez des codes-barres ou cherchez des aliments pour suivre
              vos apports, le tout sans inscription ni abonnement.
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 font-medium">Données nutritionnelles</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Fournies par{' '}
                <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline">OpenFoodFacts</a>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 mb-8 text-center">
          <p className="text-xs text-gray-400">CalTracker v1.0</p>
        </div>
      </div>
    </div>
  );
};
