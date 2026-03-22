export type Difficulty = 'Easy' | 'Medium' | 'Intermediate' | 'Expert';
export type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

export interface Ingredient {
  item: string;
  note?: string;
}

export interface InstructionStep {
  title: string;
  text: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  sourceUrl: string;
  prepTime: string;
  prepTimeMinutes?: number;
  calories: string;
  caloriesValue?: number;
  servings: string;
  servingsValue?: number;
  difficulty: Difficulty;
  category: string;
  tags: string[];
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  isFavorite: boolean;
  importedAt: string;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
}

export interface RecipeSummary {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  prepTime: string;
  calories: string;
  servings: string;
  difficulty: Difficulty;
  category: string;
  tags: string[];
  isFavorite: boolean;
  importedAt: string;
}

export interface MealSlot {
  date: string;
  mealType: MealType;
  recipeId: string;
  recipeTitle: string;
  recipeImageUrl: string;
}

export interface MealPlan {
  id: string;
  weekStartDate: string;
  slots: MealSlot[];
}

export interface GroceryItem {
  id: string;
  name: string;
  note?: string;
  quantity: number;
  category: string;
  isPurchased: boolean;
  sourceRecipeId?: string;
}

export interface GroceryList {
  id: string;
  forWeek: string;
  items: GroceryItem[];
}
