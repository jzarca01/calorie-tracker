import { useEffect, useState } from 'react';
import { Dexie } from 'dexie';
import type { CustomFood } from '../types';

// Définir les interfaces pour notre base de données
interface Meal {
  id?: number;
  date: string; // Format YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  foods: FoodItem[];
  totalCalories: number;
}

interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: string;
  servingUnit?: string;
  imageUrl?: string;
}

interface Recipe {
  id?: number;
  name: string;
  foods: FoodItem[];
  totalWeight: number;
}

// Définir notre base de données Dexie
class CalorieTrackerDB extends Dexie {
  meals!: Dexie.Table<Meal, number>;
  recipes!: Dexie.Table<Recipe, number>;
  customFoods!: Dexie.Table<CustomFood, number>;
  
  constructor() {
    super('CalorieTrackerDB');
    this.version(3).stores({
      meals: '++id, date, mealType, totalCalories',
      recipes: '++id, name',
      customFoods: '++id, name'
    });
  }
}

// Créer une instance unique de la base de données
const db = new CalorieTrackerDB();

export const useDexie = () => {
  const [isReady, setIsReady] = useState(false);
  const [dbInstance, setDbInstance] = useState<CalorieTrackerDB | null>(null);

  useEffect(() => {
    // Initialiser la base de données
    db.open()
      .then(() => {
        setDbInstance(db);
        setIsReady(true);
      })
      .catch((error) => {
        console.error('Erreur lors de l\'ouverture de la base de données:', error);
      });
  }, []);

  return { db: dbInstance, isReady };
};

// Export des types pour une utilisation dans les composants
export type { Meal, FoodItem, Recipe };