import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDexie } from '../hooks/useDexie';
import type { Meal, FoodItem, MealType } from '../types';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateNutritionalTotals } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';

const toDateString = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const History = () => {
  useAuth();
  const { db, isReady } = useDexie();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => toDateString(new Date()));
  const [loading, setLoading] = useState(false);
  const [editingFood, setEditingFood] = useState<{
    mealId: number;
    foodIndex: number;
    mealType: MealType;
    name: string;
    brand: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    quantity: number;
  } | null>(null);

  useEffect(() => {
    if (isReady) loadMealsForDate();
  }, [isReady, selectedDate]);

  const loadMealsForDate = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const results = await db.meals.where('date').equals(selectedDate).toArray();
      setMeals(results.sort((a, b) =>
        ['breakfast', 'lunch', 'snack', 'dinner'].indexOf(a.mealType) -
        ['breakfast', 'lunch', 'snack', 'dinner'].indexOf(b.mealType)
      ));
    } catch (error) { console.error('Error loading meals:', error); }
    finally { setLoading(false); }
  };

  const goPreviousDay = () => setSelectedDate(toDateString(subDays(parseISO(selectedDate), 1)));
  const goNextDay = () => setSelectedDate(toDateString(addDays(parseISO(selectedDate), 1)));
  const goToday = () => setSelectedDate(toDateString(new Date()));

  const handleDeleteFood = async (mealId: number, foodIndex: number) => {
    if (!db) return;
    try {
      const meal = await db.meals.get(mealId);
      if (!meal) return;
      const updatedFoods = meal.foods.filter((_, idx) => idx !== foodIndex);
      if (updatedFoods.length === 0) {
        await db.meals.delete(mealId);
      } else {
        const totalCalories = updatedFoods.reduce((sum, item) => sum + item.calories, 0);
        await db.meals.update(mealId, { foods: updatedFoods, totalCalories });
      }
      await loadMealsForDate();
    } catch (error) { console.error('Error deleting food:', error); }
  };

  const startEditFood = (meal: Meal, foodIndex: number) => {
    const food = meal.foods[foodIndex];
    const match = food.servingSize?.match(/^(\d+)g$/);
    const q = match ? parseInt(match[1]) : 100;
    setEditingFood({
      mealId: meal.id!,
      foodIndex,
      mealType: meal.mealType,
      name: food.name,
      brand: food.brand || '',
      calories: String(Math.round((food.calories / q) * 100)),
      protein: String(Math.round(((food.protein / q) * 100) * 10) / 10),
      carbs: String(Math.round(((food.carbs / q) * 100) * 10) / 10),
      fat: String(Math.round(((food.fat / q) * 100) * 10) / 10),
      quantity: q,
    });
  };

  const handleSaveEdit = async () => {
    if (!db || !editingFood) return;
    const cals = parseFloat(editingFood.calories);
    const prot = parseFloat(editingFood.protein);
    const car = parseFloat(editingFood.carbs);
    const f = parseFloat(editingFood.fat);
    if (!editingFood.name || isNaN(cals) || editingFood.quantity <= 0) return;

    try {
      const meal = await db.meals.get(editingFood.mealId);
      if (!meal) return;

      const scaledFood: FoodItem = {
        id: meal.foods[editingFood.foodIndex]?.id || '',
        name: editingFood.name,
        brand: editingFood.brand,
        calories: Math.round((cals / 100) * editingFood.quantity),
        protein: Math.round(((prot / 100) * editingFood.quantity) * 10) / 10,
        carbs: Math.round(((car / 100) * editingFood.quantity) * 10) / 10,
        fat: Math.round(((f / 100) * editingFood.quantity) * 10) / 10,
        servingSize: `${editingFood.quantity}g`,
        servingUnit: 'g',
      };

      const updatedFoods = [...meal.foods];
      updatedFoods[editingFood.foodIndex] = scaledFood;
      const totalCalories = updatedFoods.reduce((sum, item) => sum + item.calories, 0);

      await db.meals.update(editingFood.mealId, { foods: updatedFoods, totalCalories });
      setEditingFood(null);
      await loadMealsForDate();
    } catch (error) { console.error('Error saving edit:', error); }
  };

  const handleDeleteMeal = async (mealId: number) => {
    if (!db) return;
    try {
      await db.meals.delete(mealId);
      await loadMealsForDate();
    } catch (error) { console.error('Error deleting meal:', error); }
  };

  const isToday = selectedDate === toDateString(new Date());
  const dayMacros = calculateNutritionalTotals(meals.flatMap(m => m.foods));
  const dayCalories = meals.reduce((sum, m) => sum + m.totalCalories, 0);

  const mealLabels: Record<string, string> = {
    breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', snack: 'Goûter', dinner: 'Dîner',
  };

  const mealIcons: Record<string, string> = {
    breakfast: '🌅', lunch: '☀️', snack: '🍪', dinner: '🌙',
  };

  return (
    <div>
      <header className="page-header mx-4 mt-4 sm:mx-6 sm:mt-6 lg:mx-8 lg:mt-8">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Historique</h1>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <span className="text-2xl">📅</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3">
            <div className="flex items-center justify-between">
              <button onClick={goPreviousDay}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>

              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">
                    {format(parseISO(selectedDate), 'EEEE d MMMM', { locale: fr })}
                  </span>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs text-white/70 bg-white/10 border border-white/10 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                />
                {!isToday && (
                  <button onClick={goToday}
                    className="text-xs text-blue-300 hover:text-blue-200 font-medium"
                  >
                    Aujourd'hui
                  </button>
                )}
              </div>

              <button onClick={goNextDay}
                disabled={isToday}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-4 sm:mx-6 lg:mx-8 mt-6">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
            </motion.div>
          ) : (
            <motion.div
              key={selectedDate}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="stat-card">
                  <p className="macro-label">Calories</p>
                  <p className="text-lg font-bold text-gray-900 mt-0.5">{dayCalories} <span className="text-sm font-medium text-gray-400">kcal</span></p>
                </div>
                <div className="stat-card">
                  <p className="macro-label">Protéines</p>
                  <p className="text-lg font-bold text-blue-600 mt-0.5">{Math.round(dayMacros.protein)} <span className="text-sm font-medium text-blue-400">g</span></p>
                </div>
                <div className="stat-card">
                  <p className="macro-label">Glucides</p>
                  <p className="text-lg font-bold text-amber-600 mt-0.5">{Math.round(dayMacros.carbs)} <span className="text-sm font-medium text-amber-400">g</span></p>
                </div>
                <div className="stat-card">
                  <p className="macro-label">Lipides</p>
                  <p className="text-lg font-bold text-rose-600 mt-0.5">{Math.round(dayMacros.fat)} <span className="text-sm font-medium text-rose-400">g</span></p>
                </div>
              </div>

              {meals.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <span className="text-2xl">🍽️</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Aucun repas</h3>
                  <p className="text-sm text-gray-400 mb-4">Aucun repas enregistré pour ce jour</p>
                  <a href="/log" className="premium-btn-primary text-sm">Ajouter un repas</a>
                </div>
              ) : (
                <div className="space-y-4 pb-8">
                  {meals.map((meal) => {
                    const macros = calculateNutritionalTotals(meal.foods);
                    return (
                      <motion.div
                        key={meal.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden"
                      >
                        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">{mealIcons[meal.mealType]}</span>
                            <h3 className="text-sm font-semibold text-gray-900">
                              {mealLabels[meal.mealType]}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="chip-blue text-sm">{meal.totalCalories} kcal</span>
                            <button
                              onClick={() => handleDeleteMeal(meal.id!)}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                              title="Supprimer le repas"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="px-5 py-3 space-y-2.5">
                          {meal.foods.map((food, i) => (
                            <div key={i} className="flex items-center justify-between text-sm group">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                <span className="text-gray-700 truncate">{food.name}</span>
                                {food.brand && (
                                  <span className="text-gray-400 text-xs hidden sm:inline">({food.brand})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0 ml-3">
                                <span className="font-medium text-gray-700">{food.calories} kcal</span>
                                <span className="text-blue-500">P:{food.protein}</span>
                                <span className="text-amber-500">G:{food.carbs}</span>
                                <span className="text-rose-500">L:{food.fat}</span>
                                <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => startEditFood(meal, i)}
                                    className="p-1 rounded text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                                    title="Modifier"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteFood(meal.id!, i)}
                                    className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                    title="Supprimer"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="px-5 py-2.5 bg-gray-50/50 border-t border-gray-50 flex gap-3 text-xs">
                          <span className="text-blue-600">Protéines: {Math.round(macros.protein)}g</span>
                          <span className="text-amber-600">Glucides: {Math.round(macros.carbs)}g</span>
                          <span className="text-rose-600">Lipides: {Math.round(macros.fat)}g</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {editingFood && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setEditingFood(null)}
            />
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-gray-900">Modifier l'aliment</h3>
                <button onClick={() => setEditingFood(null)}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                  <input
                    type="text"
                    value={editingFood.name}
                    onChange={(e) => setEditingFood({ ...editingFood, name: e.target.value })}
                    className="premium-input"
                    placeholder="Nom de l'aliment"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantité (g)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="1"
                      value={editingFood.quantity || ''}
                      onChange={(e) => setEditingFood({ ...editingFood, quantity: parseInt(e.target.value) || 0 })}
                      className="premium-input max-w-[120px]"
                      placeholder="100"
                    />
                    <span className="text-sm text-gray-400">grammes</span>
                    {[50, 100, 150, 200].map((q) => (
                      <button key={q} type="button" onClick={() => setEditingFood({ ...editingFood, quantity: q })}
                        className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                          editingFood.quantity === q
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        {q}g
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'kcal', key: 'calories' as const, color: 'orange' },
                    { label: 'Prot', key: 'protein' as const, color: 'blue' },
                    { label: 'Gluc', key: 'carbs' as const, color: 'amber' },
                    { label: 'Lip', key: 'fat' as const, color: 'rose' },
                  ].map((macro) => (
                    <div key={macro.key} className={`bg-${macro.color}-50 rounded-xl p-3 text-center`}>
                      <input
                        type="number" min="0" step="0.1"
                        value={editingFood[macro.key]}
                        onChange={(e) => setEditingFood({ ...editingFood, [macro.key]: e.target.value })}
                        className={`w-full text-center text-lg font-bold bg-transparent focus:outline-none ${
                          macro.key === 'calories' ? 'text-orange-600' :
                          macro.key === 'protein' ? 'text-blue-600' :
                          macro.key === 'carbs' ? 'text-amber-600' : 'text-rose-600'
                        }`}
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500 mt-0.5">{macro.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setEditingFood(null)}
                    className="flex-1 premium-btn-secondary"
                  >
                    Annuler
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSaveEdit}
                    disabled={!editingFood.name || !editingFood.calories || parseFloat(editingFood.calories) <= 0 || editingFood.quantity <= 0}
                    className="flex-1 premium-btn-primary disabled:opacity-40"
                  >
                    Enregistrer
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
