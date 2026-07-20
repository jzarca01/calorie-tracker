import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

export const OFF_API_BASE = import.meta.env.DEV ? '/off-api' : 'https://world.openfoodfacts.org';

export const offFetch = (path: string) =>
  fetch(`${OFF_API_BASE}${path}`, {
    headers: {
      'User-Agent': 'CalorieTracker/1.0 (https://github.com/jzarca01/calorie-tracker)',
    },
  });

export const formatDate = (dateString: string) => {
  return format(parseISO(dateString), 'PPpp', { locale: fr });
};

export const formatTime = (dateString: string) => {
  return format(parseISO(dateString), 'p', { locale: fr });
};

export const isSameDay = (date1: string, date2: string) => {
  return parseISO(date1).toDateString() === parseISO(date2).toDateString();
};

export const getWeekRange = () => {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 }); // Lundi comme premier jour
  const end = endOfWeek(now, { weekStartsOn: 1 });
  return { start, end };
};

export const getMonthRange = () => {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  return { start, end };
};

import type { FoodItem } from '../types';

export const calculateNutritionalTotals = (foods: FoodItem[]) => {
  return foods.reduce((total, food) => ({
    calories: total.calories + (food.calories || 0),
    protein: total.protein + (food.protein || 0),
    carbs: total.carbs + (food.carbs || 0),
    fat: total.fat + (food.fat || 0),
  }), {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
};

export const getFoodImageUrl = (_barcode: string) => {
  // OpenFoodFacts fournit des images via leur API
  // Format: https://static.openfoodfacts.org/images/products/{first 3 digits}/{next 3}/{next 3}/last_digits/front_fr.400.full.jpg
  // Mais pour simplifier, on utilise une approche différente
  
  // En réalité, on devrait appeler l'API OpenFoodFacts pour obtenir l'URL de l'image
  // Pour cet exemple, on retourne une URL générique ou on laisse vide
  return '';
};