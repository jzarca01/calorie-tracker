import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDexie } from '../hooks/useDexie';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import type { FoodItem, MealType, Meal } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateNutritionalTotals, offFetch } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';

const toDateString = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const mapProduct = (p: any, id: string): FoodItem => ({
  id,
  name: p.product_name ?? p.productName ?? `Produit ${id}`,
  brand: p.brands ?? p.brand ?? '',
  calories: Math.round(p.nutriments?.['energy-kcal_100g'] ?? p.nutriments?.energyKcal ?? 0),
  protein: Math.round(((p.nutriments?.proteins_100g ?? p.nutriments?.proteins ?? 0)) * 10) / 10,
  carbs: Math.round(((p.nutriments?.carbohydrates_100g ?? p.nutriments?.carbohydrates ?? 0)) * 10) / 10,
  fat: Math.round(((p.nutriments?.fat_100g ?? p.nutriments?.fat ?? 0)) * 10) / 10,
  servingSize: '100g',
  servingUnit: 'g',
  imageUrl: p.image_url ?? p.imageUrl ?? '',
});

const scaleFood = (food: FoodItem, grams: number): FoodItem => ({
  ...food,
  calories: Math.round((food.calories / 100) * grams),
  protein: Math.round(((food.protein / 100) * grams) * 10) / 10,
  carbs: Math.round(((food.carbs / 100) * grams) * 10) / 10,
  fat: Math.round(((food.fat / 100) * grams) * 10) / 10,
  servingSize: `${grams}g`,
});

const lookupProduct = async (barcode: string): Promise<FoodItem | null> => {
  try {
    const res = await offFetch(`/api/v2/product/${encodeURIComponent(barcode)}.json`);
    if (!res.ok) return null;
    const json = await res.json();
    const product = json?.product;
    if (!product?.product_name) return null;
    return mapProduct(product, barcode);
  } catch { return null; }
};

const searchProducts = async (query: string): Promise<FoodItem[]> => {
  try {
    const params = new URLSearchParams({ search_terms: query, page_size: '10', fields: 'code,product_name,brands,nutriments,image_url' });
    const res = await offFetch(`/api/v2/search?${params}`);
    if (!res.ok) return [];
    const json = await res.json();
    const products = json?.products;
    if (!Array.isArray(products)) return [];
    return products.map((p: any) => mapProduct(p, p.code ?? p._id ?? query));
  } catch { return []; }
};

const mealLabels: Record<MealType, string> = {
  breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', snack: 'Goûter', dinner: 'Dîner',
};

const mealIcons: Record<MealType, string> = {
  breakfast: '🌅', lunch: '☀️', snack: '🍪', dinner: '🌙',
};

export const MealLog = () => {
  const { userGoal } = useAuth();
  const { db, isReady } = useDexie();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanControlsRef = useRef<IScannerControls | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [foodData, setFoodData] = useState<FoodItem | null>(null);
  const [manualInput, setManualInput] = useState<Partial<FoodItem>>({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [quantity, setQuantity] = useState(100);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [barcodeNotFound, setBarcodeNotFound] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<FoodItem[]>([]);
  const [customFoodsList, setCustomFoodsList] = useState<FoodItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [saveAsCustom, setSaveAsCustom] = useState(false);
  const [selectedTab, setSelectedTab] = useState<MealType>('breakfast');
  const [editingFood, setEditingFood] = useState<{
    mealId: number;
    foodIndex: number;
    name: string;
    brand: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    quantity: number;
  } | null>(null);

  useEffect(() => {
    if (isReady) {
      loadTodayMeals();
      loadRecentFoods();
      loadSavedRecipes();
      loadCustomFoods();
    }
  }, [isReady]);

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

  const loadTodayMeals = async () => {
    if (!db) return;
    try {
      const today = toDateString(new Date());
      const meals = await db.meals.where('date').equals(today).toArray();
      setTodayMeals(meals);
    } catch (error) { console.error('Error loading meals:', error); }
  };

  const handleScan = async () => {
    setScanError(null); setFoodData(null); setIsScanning(true);
    try {
      let stream: MediaStream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }); }
      catch { stream = await navigator.mediaDevices.getUserMedia({ video: true }); }
      const codeReader = new BrowserMultiFormatReader();
      const controls = await codeReader.decodeFromStream(stream, videoRef.current ?? undefined, (result, err) => {
        if (result) {
          const barcode = result.getText();
          scanControlsRef.current?.stop();
          scanControlsRef.current = null;
          setIsScanning(false);
          lookupProduct(barcode).then(product => {
            if (product) { setQuantity(100); setFoodData(product); }
            else { setBarcodeNotFound(barcode); }
          });
        }
        if (err && !(err instanceof TypeError)) { setScanError('Placez le code-barres dans le cadre.'); }
      });
      scanControlsRef.current = controls;
    } catch (error) {
      console.error(error);
      setScanError("Impossible d'accéder à la caméra.");
      setIsScanning(false);
    }
  };

  const stopScan = () => {
    scanControlsRef.current?.stop();
    scanControlsRef.current = null;
    setIsScanning(false);
    setScanError(null);
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setManualInput(prev => ({ ...prev, [name]: name === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) }));
  };

  const handleNameSearch = (value: string) => {
    setManualInput(prev => ({ ...prev, name: value }));
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const val = value.trim().toLowerCase();

    const getLocalSuggestions = (q: string) => {
      const combined = [...recentFoods, ...customFoodsList.filter(cf => !recentFoods.some(rf => rf.id === cf.id)), ...savedRecipes.filter(r => !recentFoods.some(rf => rf.id === r.id) && !customFoodsList.some(cf => cf.id === r.id))];
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
    setQuantity(100); setFoodData(food); setIsEditing(false); setShowForm(true);
    setShowSearchDropdown(false); setSearchResults([]);
    setManualInput({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const saveFood = async (food: FoodItem) => {
    if (!db || !userGoal) return;
    try {
      const today = toDateString(new Date());
      const existingMeal = await db.meals.filter(m => m.date === today && m.mealType === selectedMealType).first();
      if (existingMeal && existingMeal.id !== undefined) {
        const updatedFoods = [...existingMeal.foods, food];
        const totalCalories = updatedFoods.reduce((sum, item) => sum + item.calories, 0);
        await db.meals.update(existingMeal.id, { foods: updatedFoods, totalCalories });
      } else {
        await db.meals.add({ date: today, mealType: selectedMealType, foods: [food], totalCalories: food.calories });
      }

      if (isEditing && foodData) {
        await db.recipes.add({ name: foodData.name, totalWeight: 100, foods: [{ ...foodData, servingSize: '100g' }] });
        await loadSavedRecipes();
      }

      if (saveAsCustom) {
        const match = food.servingSize?.match(/^(\d+)g$/);
        const q = match ? parseInt(match[1]) : 100;
        await db.customFoods.add({
          name: food.name,
          calories: Math.round((food.calories / q) * 100),
          protein: Math.round(((food.protein / q) * 100) * 10) / 10,
          carbs: Math.round(((food.carbs / q) * 100) * 10) / 10,
          fat: Math.round(((food.fat / q) * 100) * 10) / 10,
        });
        await loadCustomFoods();
        setSaveAsCustom(false);
      }

      setFoodData(null); setIsEditing(false); setShowForm(false);
      setManualInput({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0 });
      await loadTodayMeals(); await loadRecentFoods();
    } catch (error) { console.error('Erreur lors de la sauvegarde:', error); }
  };

  const deleteFood = async (mealId: number, foodIndex: number) => {
    if (!db) return;
    try {
      const meal = await db.meals.get(mealId);
      if (!meal) return;
      const updatedFoods = meal.foods.filter((_, idx) => idx !== foodIndex);
      if (updatedFoods.length === 0) { await db.meals.delete(mealId); }
      else {
        const totalCalories = updatedFoods.reduce((sum, item) => sum + item.calories, 0);
        await db.meals.update(mealId, { foods: updatedFoods, totalCalories });
      }
      await loadTodayMeals(); await loadRecentFoods();
    } catch (error) { console.error('Error deleting food:', error); }
  };

  const editFood = (meal: Meal, foodIndex: number) => {
    if (meal.id === undefined) return;
    const food = meal.foods[foodIndex];
    const match = food.servingSize?.match(/^(\d+)g$/);
    const q = match ? parseInt(match[1]) : 100;
    setEditingFood({
      mealId: meal.id,
      foodIndex,
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
    if (!editingFood.name || isNaN(cals)) return;

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
      await loadTodayMeals();
      await loadRecentFoods();
    } catch (error) { console.error('Error saving edit:', error); }
  };

  const totalConsumedCalories = todayMeals.reduce((sum, meal) => sum + meal.totalCalories, 0);
  const remainingCalories = Math.max(userGoal! - totalConsumedCalories, 0);
  const progressPercent = Math.min(Math.round((totalConsumedCalories / userGoal!) * 100), 100);
  const allFoods = todayMeals.flatMap(m => m.foods);
  const totalMacros = calculateNutritionalTotals(allFoods);

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

  return (
    <div>
      {/* Header */}
      <header className="page-header mx-4 mt-4 sm:mx-6 sm:mt-6 lg:mx-8 lg:mt-8">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Journal
              </h1>
              <p className="text-blue-100 text-sm mt-1">
                {format(new Date(), 'EEEE d MMMM', { locale: fr })}
              </p>
            </div>
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>

          {/* Progress ring */}
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
                <motion.circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke="white" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52}
                  initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - progressPercent / 100) }}
                  transition={{ duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{progressPercent}%</p>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-white/80">{totalConsumedCalories} kcal</span>
                <span className="text-white/60">Objectif: {userGoal}</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${progressPercent >= 100 ? 'bg-yellow-400' : 'bg-white'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
              </div>
              <p className="text-white/60 text-xs mt-1.5">
                {remainingCalories > 0 ? `Il reste ${remainingCalories} kcal` : 'Objectif atteint !'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Macros row */}
      <div className="mx-4 sm:mx-6 lg:mx-8 mt-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Protéines', value: Math.round(totalMacros.protein), unit: 'g', color: 'blue' },
            { label: 'Glucides', value: Math.round(totalMacros.carbs), unit: 'g', color: 'amber' },
            { label: 'Lipides', value: Math.round(totalMacros.fat), unit: 'g', color: 'rose' },
          ].map((macro) => (
            <motion.div
              key={macro.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="stat-card"
            >
              <p className="macro-label">{macro.label}</p>
              <p className={`macro-value text-${macro.color}-600`}>
                {macro.value}
                <span className="text-sm font-medium text-gray-400 ml-0.5">{macro.unit}</span>
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Meal type tabs */}
      <div className="mx-4 sm:mx-6 lg:mx-8 mt-6">
        <div className="flex gap-1.5 bg-gray-100/80 rounded-2xl p-1 overflow-x-auto">
          {mealTypes.map((type) => {
            const meal = todayMeals.find(m => m.mealType === type);
            const cals = meal?.totalCalories || 0;
            return (
              <button
                key={type}
                onClick={() => setSelectedTab(type)}
                className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                  selectedTab === type
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="text-lg">{mealIcons[type]}</span>
                <span className="truncate w-full text-center">{mealLabels[type]}</span>
                {cals > 0 && (
                  <span className="text-[10px] font-semibold text-blue-600">{cals} kcal</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Foods for selected tab */}
        <div className="mt-4">
            {(['breakfast', 'lunch', 'snack', 'dinner'] as MealType[]).filter(t => t === selectedTab).map((mealType) => {
            const meal = todayMeals.find(m => m.mealType === mealType);
            const foods = meal?.foods || [];
            return (
              <motion.div
                key={mealType}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {foods.length === 0 ? (
                  <div className="empty-state py-8">
                    <div className="empty-state-icon">
                      <span className="text-2xl">{mealIcons[mealType]}</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">Aucun aliment dans ce repas</p>
                    <button
                      onClick={() => { setSelectedMealType(mealType); setShowForm(true); }}
                      className="premium-btn-secondary text-xs"
                    >
                      Ajouter un aliment
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100/80 divide-y divide-gray-50 overflow-hidden">
                    {foods.map((food, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/50 transition-colors"
                      >
                        {food.imageUrl ? (
                          <img src={food.imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover border border-gray-100" />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{food.name}</p>
                          <p className="text-xs text-gray-400">
                            {food.servingSize}
                            {food.brand && <span className="ml-1">· {food.brand}</span>}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-gray-900">{food.calories}</p>
                          <p className="text-[10px] text-gray-400">kcal</p>
                        </div>
                        <div className="flex items-center gap-1 ml-1">
                          <button onClick={() => meal && editFood(meal, idx)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>
                          <button onClick={() => meal?.id !== undefined && deleteFood(meal.id!, idx)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </motion.div>
                    ))}
                    <button
                      onClick={() => { setSelectedMealType(mealType); setShowForm(true); }}
                      className="w-full px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50/50 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Ajouter un aliment
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* FAB */}
      <AnimatePresence>
        <div className="fixed bottom-24 right-6 z-40 md:bottom-8 flex flex-col items-end gap-3">
          <AnimatePresence>
            {fabOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="flex flex-col gap-2 items-end"
              >
                <button
                  onClick={() => { setFabOpen(false); setShowForm(true); setFoodData(null); setBarcodeNotFound(null); setIsEditing(false); }}
                  className="flex items-center gap-2.5 bg-white text-gray-700 pr-5 pl-4 py-2.5 rounded-2xl shadow-xl border border-gray-100 text-sm font-medium hover:bg-gray-50 transition-all"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </div>
                  Saisie manuelle
                </button>
                <button
                  onClick={() => { setFabOpen(false); handleScan(); setShowForm(true); }}
                  disabled={isScanning}
                  className="flex items-center gap-2.5 bg-white text-gray-700 pr-5 pl-4 py-2.5 rounded-2xl shadow-xl border border-gray-100 text-sm font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                    </svg>
                  </div>
                  Scanner
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFabOpen(!fabOpen)}
            className={`w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-300 ${
              fabOpen ? 'bg-gray-900 rotate-45 shadow-gray-900/20' : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'
            }`}
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </motion.button>
        </div>
      </AnimatePresence>

      {/* Modal overlay */}
      <AnimatePresence>
        {showForm && (
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
              onClick={() => { setShowForm(false); setFoodData(null); setIsEditing(false); stopScan(); setBarcodeNotFound(null); }}
            />
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10 rounded-t-3xl">
                <div className="flex gap-1.5 overflow-x-auto">
                  {(['breakfast', 'lunch', 'snack', 'dinner'] as MealType[]).map((type) => (
                    <button key={type} onClick={() => setSelectedMealType(type)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                        selectedMealType === type ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <span>{mealIcons[type]}</span>
                      {mealLabels[type]}
                    </button>
                  ))}
                </div>
                <button onClick={() => { setShowForm(false); setFoodData(null); setIsEditing(false); stopScan(); setBarcodeNotFound(null); }}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 ml-2 flex-shrink-0 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-4 space-y-5">
                {isScanning && (
                  <div className="relative rounded-2xl overflow-hidden bg-black">
                    <video ref={videoRef} className="w-full max-w-md mx-auto" playsInline />
                    <button onClick={stopScan}
                      className="absolute top-3 right-3 px-4 py-2 text-sm font-medium bg-red-500/90 text-white rounded-xl backdrop-blur-sm hover:bg-red-600 transition-all">
                      Annuler
                    </button>
                    {scanError && <p className="mt-2 text-sm text-red-500 text-center">{scanError}</p>}
                  </div>
                )}

                {barcodeNotFound && !foodData && !isScanning && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 border border-amber-200 rounded-2xl p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-800">Code-barres introuvable</p>
                        <p className="text-sm text-amber-700 mt-1">Créez un aliment personnalisé.</p>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => { setManualInput({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0 }); setBarcodeNotFound(null); setSaveAsCustom(true); }}
                            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-all">
                            Créer
                          </button>
                          <button onClick={() => setBarcodeNotFound(null)}
                            className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-100 rounded-xl hover:bg-amber-200 transition-all">
                            Annuler
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {foodData && (() => {
                  const scaled = scaleFood(foodData, quantity);
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-5"
                    >
                      <div className="flex items-center gap-4">
                        {foodData.imageUrl && (
                          <img src={foodData.imageUrl} alt={foodData.name} className="w-16 h-16 rounded-2xl object-cover border border-gray-100" />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{foodData.name}</h3>
                          {foodData.brand && <p className="text-sm text-gray-400 truncate">{foodData.brand}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">Valeurs pour 100g: {foodData.calories} kcal</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Quantité</label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 max-w-[140px]">
                            <input
                              type="number" min="1" value={quantity}
                              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                              className="premium-input pr-10"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">g</span>
                          </div>
                          <div className="flex gap-1.5">
                            {[50, 100, 150, 200].map((q) => (
                              <button key={q} type="button" onClick={() => setQuantity(q)}
                                className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                                  quantity === q
                                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
                                }`}
                              >
                                {q}g
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'kcal', value: scaled.calories, color: 'orange' },
                          { label: 'Prot', value: scaled.protein, color: 'blue' },
                          { label: 'Gluc', value: scaled.carbs, color: 'amber' },
                          { label: 'Lip', value: scaled.fat, color: 'rose' },
                        ].map((macro) => (
                          <div key={macro.label} className={`bg-${macro.color}-50 rounded-xl p-3 text-center`}>
                            {isEditing ? (
                              <input type="number" min="0" step="0.1"
                                value={macro.value}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  if (macro.label === 'kcal') setFoodData({ ...foodData, calories: val });
                                  if (macro.label === 'Prot') setFoodData({ ...foodData, protein: val });
                                  if (macro.label === 'Gluc') setFoodData({ ...foodData, carbs: val });
                                  if (macro.label === 'Lip') setFoodData({ ...foodData, fat: val });
                                }}
                                className={`w-full text-center text-lg font-bold bg-transparent focus:outline-none ${
                                  macro.label === 'kcal' ? 'text-orange-600' :
                                  macro.label === 'Prot' ? 'text-blue-600' :
                                  macro.label === 'Gluc' ? 'text-amber-600' : 'text-rose-600'
                                }`}
                              />
                            ) : (
                              <p className={`text-lg font-bold tracking-tight ${
                                macro.label === 'kcal' ? 'text-orange-600' :
                                macro.label === 'Prot' ? 'text-blue-600' :
                                macro.label === 'Gluc' ? 'text-amber-600' : 'text-rose-600'
                              }`}>
                                {macro.value}<span className="text-xs font-medium ml-0.5">{macro.label}</span>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => saveFood(scaled)}
                          className="flex-1 premium-btn-primary"
                        >
                          Ajouter au {mealLabels[selectedMealType].toLowerCase()}
                        </motion.button>
                        <button onClick={() => setIsEditing(!isEditing)}
                          className={`px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                            isEditing ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <button onClick={() => { setFoodData(null); setIsEditing(false); }}
                          className="px-4 py-3 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  );
                })()}

                {!foodData && !barcodeNotFound && !isScanning && (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (manualInput.name && (manualInput.calories ?? 0) > 0) {
                      saveFood({
                        id: Math.random().toString(36).substring(2, 9),
                        name: manualInput.name ?? '', brand: '',
                        calories: manualInput.calories ?? 0,
                        protein: manualInput.protein || 0,
                        carbs: manualInput.carbs || 0,
                        fat: manualInput.fat || 0,
                        servingSize: '1 portion', servingUnit: 'portion',
                      });
                    }
                  }} className="space-y-5">
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l'aliment</label>
                      <input
                        type="text" value={manualInput.name || ''}
                        onFocus={() => {
                          const val = (manualInput.name || '').trim().toLowerCase();
                          const combined = [...recentFoods, ...customFoodsList.filter(cf => !recentFoods.some(rf => rf.id === cf.id)), ...savedRecipes.filter(r => !recentFoods.some(rf => rf.id === r.id) && !customFoodsList.some(cf => cf.id === r.id))];
                          const filtered = val.length === 0 ? combined : combined.filter(f => f.name.toLowerCase().includes(val));
                          if (filtered.length > 0) { setSearchResults(filtered); setShowSearchDropdown(true); }
                        }}
                        onBlur={() => setTimeout(() => setShowSearchDropdown(false), 300)}
                        onChange={(e) => handleNameSearch(e.target.value)}
                        className="premium-input"
                        placeholder="Rechercher un aliment..."
                        autoComplete="off"
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-[42px]">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                        </div>
                      )}
                      {showSearchDropdown && searchResults.length > 0 && (
                        <div className="absolute z-10 mt-1.5 w-full bg-white border border-gray-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto">
                          {searchResults.map((item) => (
                            <button key={item.id} type="button"
                              onMouseDown={(e) => { e.preventDefault(); selectSearchResult(item); }}
                              className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-50 last:border-0 transition-colors"
                            >
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt="" className="w-9 h-9 rounded-xl object-cover border border-gray-100" />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                                  <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                  </svg>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                <p className="text-xs text-gray-400 truncate">{item.brand} · {item.calories} kcal/100g</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Calories', name: 'calories', unit: 'kcal', color: 'orange' },
                        { label: 'Protéines', name: 'protein', unit: 'g', color: 'blue' },
                        { label: 'Glucides', name: 'carbs', unit: 'g', color: 'amber' },
                        { label: 'Lipides', name: 'fat', unit: 'g', color: 'rose' },
                      ].map((field) => (
                        <div key={field.name}>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">{field.label}</label>
                          <div className="relative">
                            <input
                              name={field.name} type="number" min="0" step="0.1"
                              value={(manualInput as any)[field.name] || 0}
                              onChange={handleManualInputChange}
                              className={`premium-input pr-8 text-sm ${
                                field.color === 'orange' ? 'focus:ring-orange-500/20 focus:border-orange-500' :
                                field.color === 'blue' ? 'focus:ring-blue-500/20 focus:border-blue-500' :
                                field.color === 'amber' ? 'focus:ring-amber-500/20 focus:border-amber-500' :
                                'focus:ring-rose-500/20 focus:border-rose-500'
                              }`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{field.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {barcodeNotFound && (
                      <label className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveAsCustom}
                          onChange={(e) => setSaveAsCustom(e.target.checked)}
                          className="w-4 h-4 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500/30"
                        />
                        Enregistrer comme aliment personnalisé
                      </label>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="w-full premium-btn-primary"
                    >
                      Ajouter
                    </motion.button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

                <input
                  type="text"
                  value={editingFood.brand}
                  onChange={(e) => setEditingFood({ ...editingFood, brand: e.target.value })}
                  placeholder="Marque (optionnel)"
                  className="premium-input"
                />

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
