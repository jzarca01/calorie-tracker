import { useState, useEffect, useRef } from 'react';
import { useDexie } from '../hooks/useDexie';
import type { FoodItem, Recipe } from '../types';
import { calculateNutritionalTotals, offFetch } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';

export const Recipes = () => {
  const { db, isReady } = useDexie();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipeWeight, setRecipeWeight] = useState(0);
  const [ingredients, setIngredients] = useState<{ food: FoodItem, quantity: number }[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<FoodItem[]>([]);
  const [customFoodsList, setCustomFoodsList] = useState<FoodItem[]>([]);

  const [showCustomFoodForm, setShowCustomFoodForm] = useState(false);
  const [customFoodName, setCustomFoodName] = useState('');
  const [customFoodCalories, setCustomFoodCalories] = useState(0);
  const [customFoodProtein, setCustomFoodProtein] = useState(0);
  const [customFoodCarbs, setCustomFoodCarbs] = useState(0);
  const [customFoodFat, setCustomFoodFat] = useState(0);
  const [editingCustomFoodId, setEditingCustomFoodId] = useState<number | null>(null);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);

  useEffect(() => {
    if (isReady) {
      loadRecipes();
      loadRecentFoods();
      loadSavedRecipes();
      loadCustomFoods();
    }
  }, [isReady]);

  const loadRecipes = async () => {
    if (!db) return;
    try { setRecipes(await db.recipes.toArray()); }
    catch (error) { console.error('Error loading recipes:', error); }
  };

  const loadRecentFoods = async () => {
    if (!db) return;
    try {
      const allMeals = await db.meals.orderBy('date').reverse().limit(30).toArray();
      const uniqueFoods = new Map<string, FoodItem>();
      allMeals.forEach(meal => {
        meal.foods.forEach(food => {
          const match = food.servingSize?.match(/^(\d+)g$/);
          const q = match ? parseInt(match[1]) : 100;
          if (!uniqueFoods.has(food.id)) {
            uniqueFoods.set(food.id, {
              ...food,
              calories: Math.round((food.calories / q) * 100),
              protein: Math.round(((food.protein / q) * 100) * 10) / 10,
              carbs: Math.round(((food.carbs / q) * 100) * 10) / 10,
              fat: Math.round(((food.fat / q) * 100) * 10) / 10,
              servingSize: '100g',
            });
          }
        });
      });
      setRecentFoods(Array.from(uniqueFoods.values()).slice(0, 10));
    } catch (e) { console.error('Error loading recent foods', e); }
  };

  const loadSavedRecipes = async () => {
    if (!db) return;
    try {
      const recipes = await db.recipes.toArray();
      const mapped = recipes.map(r => {
        const totalCals = r.foods.reduce((sum, f) => sum + f.calories, 0);
        const totalProt = r.foods.reduce((sum, f) => sum + f.protein, 0);
        const totalCarbs = r.foods.reduce((sum, f) => sum + f.carbs, 0);
        const totalFat = r.foods.reduce((sum, f) => sum + f.fat, 0);
        return {
          id: `recipe-${r.id}`, name: r.name, brand: 'Recette personnalisée',
          calories: Math.round((totalCals / r.totalWeight) * 100),
          protein: Math.round((totalProt / r.totalWeight) * 100 * 10) / 10,
          carbs: Math.round((totalCarbs / r.totalWeight) * 100 * 10) / 10,
          fat: Math.round((totalFat / r.totalWeight) * 100 * 10) / 10,
          servingSize: '100g', servingUnit: 'g',
        };
      });
      setSavedRecipes(mapped);
    } catch (e) { console.error('Error loading recipes', e); }
  };

  const loadCustomFoods = async () => {
    if (!db) return;
    try {
      const all = await db.customFoods.toArray();
      setCustomFoodsList(all.map(cf => ({
        id: `custom-${cf.id}`, name: cf.name, brand: 'Aliment personnalisé',
        calories: cf.calories, protein: cf.protein, carbs: cf.carbs, fat: cf.fat,
        servingSize: '100g', servingUnit: 'g',
      })));
    } catch (e) { console.error('Error loading custom foods', e); }
  };

  const saveCustomFood = async () => {
    if (!db || !customFoodName) return;
    try {
      if (editingCustomFoodId !== null) {
        await db.customFoods.update(editingCustomFoodId, { name: customFoodName, calories: customFoodCalories, protein: customFoodProtein, carbs: customFoodCarbs, fat: customFoodFat });
      } else {
        await db.customFoods.add({ name: customFoodName, calories: customFoodCalories, protein: customFoodProtein, carbs: customFoodCarbs, fat: customFoodFat });
      }
      setCustomFoodName(''); setCustomFoodCalories(0); setCustomFoodProtein(0); setCustomFoodCarbs(0); setCustomFoodFat(0);
      setEditingCustomFoodId(null); setShowCustomFoodForm(false);
      await loadCustomFoods();
    } catch (e) { console.error('Error saving custom food', e); }
  };

  const editCustomFood = (item: FoodItem) => {
    const rawId = parseInt(item.id?.replace('custom-', '') || '0');
    setEditingCustomFoodId(rawId); setCustomFoodName(item.name);
    setCustomFoodCalories(item.calories); setCustomFoodProtein(item.protein);
    setCustomFoodCarbs(item.carbs); setCustomFoodFat(item.fat);
    setShowCustomFoodForm(true); setIsCreating(false);
  };

  const deleteCustomFood = async (id?: number) => {
    if (!db || id === undefined) return;
    await db.customFoods.delete(id);
    await loadCustomFoods();
  };

  const searchProducts = async (query: string): Promise<FoodItem[]> => {
    try {
      const params = new URLSearchParams({ search_terms: query, page_size: '10', fields: 'code,product_name,brands,nutriments,image_url' });
      const res = await offFetch(`/api/v2/search?${params}`);
      if (!res.ok) return [];
      const json = await res.json();
      const products = json?.products;
      if (!Array.isArray(products)) return [];
      return products.map((p: any) => ({
        id: p.code ?? p._id ?? query, name: p.product_name ?? p.productName ?? `Produit`,
        brand: p.brands ?? p.brand ?? '',
        calories: Math.round(p.nutriments?.['energy-kcal_100g'] ?? p.nutriments?.energyKcal ?? 0),
        protein: Math.round(((p.nutriments?.proteins_100g ?? p.nutriments?.proteins ?? 0)) * 10) / 10,
        carbs: Math.round(((p.nutriments?.carbohydrates_100g ?? p.nutriments?.carbohydrates ?? 0)) * 10) / 10,
        fat: Math.round(((p.nutriments?.fat_100g ?? p.nutriments?.fat ?? 0)) * 10) / 10,
        servingSize: '100g', servingUnit: 'g', imageUrl: p.image_url ?? p.imageUrl ?? '',
      }));
    } catch { return []; }
  };

  const handleNameSearch = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const val = value.trim().toLowerCase();

    const getLocalSuggestions = (q: string) => {
      const combined = [...recentFoods, ...savedRecipes.filter(r => !recentFoods.some(rf => rf.id === r.id)), ...customFoodsList.filter(cf => !recentFoods.some(rf => rf.id === cf.id) && !savedRecipes.some(r => r.id === cf.id))];
      if (q.length === 0) return combined;
      return combined.filter(f => f.name.toLowerCase().includes(q));
    };

    const runSearch = async (query: string) => {
      setIsSearching(true);
      const localSuggestions = getLocalSuggestions(query);
      let offResults: FoodItem[] = [];
      if (query.trim().length >= 2) { offResults = await searchProducts(query.trim()); }
      const combined = [...localSuggestions, ...offResults.filter(r => !localSuggestions.some(l => l.id === r.id))];
      setSearchResults(combined); setShowSearchDropdown(combined.length > 0); setIsSearching(false);
    };

    if (val.length < 2) {
      const localSuggestions = getLocalSuggestions(val);
      setSearchResults(localSuggestions); setShowSearchDropdown(localSuggestions.length > 0); setIsSearching(false);
      return;
    }
    searchTimerRef.current = setTimeout(() => runSearch(val), 300);
  };

  const selectSearchResult = (food: FoodItem) => {
    setIngredients([...ingredients, { food, quantity: 100 }]);
    setSearchQuery(''); setShowSearchDropdown(false); setSearchResults([]);
  };

  const updateIngredientQuantity = (index: number, newQuantity: number) => {
    const newIngredients = [...ingredients];
    newIngredients[index].quantity = newQuantity;
    setIngredients(newIngredients);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const saveRecipe = async () => {
    if (!db || !recipeName || ingredients.length === 0 || recipeWeight <= 0) return;
    try {
      const recipeFoods = ingredients.map(ing => ({
        ...ing.food,
        calories: Math.round((ing.food.calories / 100) * ing.quantity),
        protein: Math.round(((ing.food.protein / 100) * ing.quantity) * 10) / 10,
        carbs: Math.round(((ing.food.carbs / 100) * ing.quantity) * 10) / 10,
        fat: Math.round(((ing.food.fat / 100) * ing.quantity) * 10) / 10,
        servingSize: `${ing.quantity}g`,
      }));

      if (editingRecipeId !== null) {
        await db.recipes.update(editingRecipeId, { name: recipeName, totalWeight: recipeWeight, foods: recipeFoods });
      } else {
        await db.recipes.add({ name: recipeName, totalWeight: recipeWeight, foods: recipeFoods });
      }

      setRecipeName(''); setRecipeWeight(0); setIngredients([]);
      setIsCreating(false); setEditingRecipeId(null);
      await loadRecipes();
    } catch (e) { console.error('Error saving recipe', e); }
  };

  const editRecipe = async (recipe: Recipe) => {
    if (!db || !recipe.id) return;
    setEditingRecipeId(recipe.id); setRecipeName(recipe.name); setRecipeWeight(recipe.totalWeight);
    const reconstructedIngredients = recipe.foods.map(f => {
      const match = f.servingSize?.match(/^(\d+)g$/);
      const q = match ? parseInt(match[1]) : 100;
      return {
        food: {
          ...f,
          calories: Math.round((f.calories / q) * 100),
          protein: Math.round(((f.protein / q) * 100) * 10) / 10,
          carbs: Math.round(((f.carbs / q) * 100) * 10) / 10,
          fat: Math.round(((f.fat / q) * 100) * 10) / 10,
          servingSize: '100g',
        },
        quantity: q,
      };
    });
    setIngredients(reconstructedIngredients); setIsCreating(true); setShowCustomFoodForm(false);
  };

  const deleteRecipe = async (id?: number) => {
    if (!db || id === undefined) return;
    await db.recipes.delete(id);
    await loadRecipes();
  };

  return (
    <div>
      <header className="page-header mx-4 mt-4 sm:mx-6 sm:mt-6 lg:mx-8 lg:mt-8">
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Recettes</h1>
              <p className="text-blue-100 text-sm mt-1">Créez des repas personnalisés</p>
            </div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <span className="text-2xl">📖</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-4 sm:mx-6 lg:mx-8 mt-6 space-y-6">

        {/* Action buttons */}
        {!isCreating && !showCustomFoodForm && (
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setShowCustomFoodForm(true); setIsCreating(false); }}
              className="flex-1 premium-btn-secondary"
            >
              + Aliment
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setIsCreating(true); setShowCustomFoodForm(false); }}
              className="flex-1 premium-btn-primary"
            >
              + Recette
            </motion.button>
          </div>
        )}

        <AnimatePresence>
          {isCreating && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                  {editingRecipeId !== null ? 'Modifier la recette' : 'Nouvelle recette'}
                </h3>
                <button onClick={() => { setIsCreating(false); setEditingRecipeId(null); }}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du repas</label>
                    <input type="text" value={recipeName} onChange={(e) => setRecipeName(e.target.value)}
                      placeholder="Ex: Porridge du matin"
                      className="premium-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Poids total (g)</label>
                    <input type="number" value={recipeWeight || ''} onChange={(e) => setRecipeWeight(parseInt(e.target.value) || 0)}
                      placeholder="Poids du plat"
                      className="premium-input"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ingrédients</label>
                  <div className="relative">
                    <input type="text" value={searchQuery} onChange={(e) => handleNameSearch(e.target.value)}
                      onFocus={() => {
                        const val = searchQuery.trim().toLowerCase();
                        const combined = [...recentFoods, ...customFoodsList.filter(cf => !recentFoods.some(rf => rf.id === cf.id)), ...savedRecipes.filter(r => !recentFoods.some(rf => rf.id === r.id) && !customFoodsList.some(cf => cf.id === r.id))];
                        const filtered = val.length === 0 ? combined : combined.filter(f => f.name.toLowerCase().includes(val));
                        if (filtered.length > 0) { setSearchResults(filtered); setShowSearchDropdown(true); }
                      }}
                      onBlur={() => setTimeout(() => setShowSearchDropdown(false), 300)}
                      placeholder="Rechercher un aliment..."
                      className="premium-input"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-3.5">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                      </div>
                    )}
                    {showSearchDropdown && searchResults.length > 0 && (
                      <div className="absolute z-10 mt-1.5 w-full bg-white border border-gray-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto">
                        {searchResults.map((item) => (
                          <button key={item.id} type="button"
                            onMouseDown={(e) => { e.preventDefault(); selectSearchResult(item); }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-50 last:border-0 transition-colors"
                          >
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt="" className="w-9 h-9 rounded-xl object-cover border border-gray-100" />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                                <span className="text-gray-300 text-xs">🍽️</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                              <p className="text-xs text-gray-400">{item.brand} · {item.calories} kcal/100g</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {ingredients.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-gray-50 rounded-xl p-4"
                    >
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Ingrédients ({ingredients.length})</h4>
                      <div className="space-y-2">
                        {ingredients.map((ing, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{ing.food.name}</p>
                              <p className="text-xs text-gray-400">{ing.food.calories} kcal/100g</p>
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              <div className="flex items-center gap-1">
                                <input type="number" min="1" value={ing.quantity}
                                  onChange={(e) => updateIngredientQuantity(idx, parseInt(e.target.value) || 0)}
                                  className="w-14 px-2 py-1 text-sm border border-gray-200 rounded-lg text-center"
                                />
                                <span className="text-xs text-gray-400">g</span>
                              </div>
                              <button onClick={() => removeIngredient(idx)}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setIsCreating(false); setEditingRecipeId(null); }}
                    className="premium-btn-secondary"
                  >
                    Annuler
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={saveRecipe}
                    disabled={!recipeName || ingredients.length === 0 || recipeWeight <= 0}
                    className="premium-btn-primary"
                  >
                    {editingRecipeId !== null ? 'Mettre à jour' : 'Sauvegarder'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCustomFoodForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                  {editingCustomFoodId !== null ? "Modifier l'aliment" : 'Nouvel aliment'}
                </h3>
                <button onClick={() => { setShowCustomFoodForm(false); setEditingCustomFoodId(null); }}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                  <input type="text" value={customFoodName} onChange={(e) => setCustomFoodName(e.target.value)}
                    placeholder="Ex: Pâte de cacahuète"
                    className="premium-input"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Calories', unit: 'kcal', value: customFoodCalories, set: setCustomFoodCalories, color: 'orange' },
                    { label: 'Protéines', unit: 'g', value: customFoodProtein, set: setCustomFoodProtein, color: 'blue' },
                    { label: 'Glucides', unit: 'g', value: customFoodCarbs, set: setCustomFoodCarbs, color: 'amber' },
                    { label: 'Lipides', unit: 'g', value: customFoodFat, set: setCustomFoodFat, color: 'rose' },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">{field.label}</label>
                      <div className="relative">
                        <input type="number" min="0" step="0.1"
                          value={field.value || ''} onChange={(e) => field.set(parseFloat(e.target.value) || 0)}
                          className="premium-input pr-8 text-sm"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">{field.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setShowCustomFoodForm(false); setEditingCustomFoodId(null); }}
                    className="premium-btn-secondary"
                  >
                    Annuler
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={saveCustomFood}
                    disabled={!customFoodName}
                    className="premium-btn-primary"
                  >
                    {editingCustomFoodId !== null ? "Mettre à jour" : "Sauvegarder"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom foods list */}
        {customFoodsList.length > 0 && !isCreating && !showCustomFoodForm && (
          <div className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Aliments personnalisés</h3>
              <p className="text-xs text-gray-400 mt-0.5">{customFoodsList.length} aliment(s)</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
              {customFoodsList.map(item => (
                <div key={item.id}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.calories} kcal/100g</p>
                  </div>
                  <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                    <button onClick={() => editCustomFood(item)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </button>
                    <button onClick={() => deleteCustomFood(parseInt(item.id?.replace('custom-', '') || '0'))}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recipes grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
          {recipes.map(recipe => {
            const totalCals = recipe.foods.reduce((sum, f) => sum + f.calories, 0);
            const macros = calculateNutritionalTotals(recipe.foods);
            const per100 = recipe.totalWeight > 0 ? {
              protein: Math.round((macros.protein / recipe.totalWeight) * 100 * 10) / 10,
              carbs: Math.round((macros.carbs / recipe.totalWeight) * 100 * 10) / 10,
              fat: Math.round((macros.fat / recipe.totalWeight) * 100 * 10) / 10,
            } : { protein: 0, carbs: 0, fat: 0 };

            return (
              <motion.div
                key={recipe.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100/80 p-5 hover:shadow-md hover:border-gray-200 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{recipe.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{recipe.totalWeight}g</p>
                  </div>
                  <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                    <button onClick={() => editRecipe(recipe)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </button>
                    <button onClick={() => deleteRecipe(recipe.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <span className="chip-blue text-xs">
                    {Math.round((totalCals / recipe.totalWeight) * 100)} kcal / 100g
                  </span>
                </div>

                <div className="flex gap-3 text-xs font-medium mb-3">
                  <span className="text-blue-600">P: {per100.protein}g</span>
                  <span className="text-amber-600">G: {per100.carbs}g</span>
                  <span className="text-rose-600">L: {per100.fat}g</span>
                </div>

                <div className="text-xs text-gray-400 space-y-1">
                  {recipe.foods.map((f, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="truncate pr-2">{f.name}</span>
                      <span className="text-gray-500 flex-shrink-0">{f.servingSize}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
          {recipes.length === 0 && !isCreating && (
            <div className="col-span-full empty-state">
              <div className="empty-state-icon">
                <span className="text-2xl">📖</span>
              </div>
              <p className="text-sm text-gray-400 mb-3">Aucune recette pour le moment</p>
              <button onClick={() => setIsCreating(true)}
                className="premium-btn-primary text-sm"
              >
                Créer une recette
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
