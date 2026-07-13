export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export interface FoodItem {
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

export interface Meal {
  id?: number;
  date: string; // Format YYYY-MM-DD
  mealType: MealType;
  foods: FoodItem[];
  totalCalories: number;
}

export interface Recipe {
  id?: number;
  name: string;
  foods: FoodItem[];
  totalWeight: number;
}

export interface CustomFood {
  id?: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface UserSettings {
  dailyGoal: number;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
}