import type { MealPlan, MealType } from '../types';

const BASE = '/api/mealplan';

export async function getMealPlan(weekStartDate: string): Promise<MealPlan> {
  const res = await fetch(`${BASE}/${weekStartDate}`, { credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function assignSlot(
  weekStartDate: string,
  date: string,
  mealType: MealType,
  recipeId: string
): Promise<MealPlan> {
  const res = await fetch(`${BASE}/${weekStartDate}/slots`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ date, mealType, recipeId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function removeSlot(
  weekStartDate: string,
  date: string,
  mealType: MealType,
  recipeId: string
): Promise<MealPlan> {
  const qs = new URLSearchParams({ date, mealType, recipeId });
  const res = await fetch(`${BASE}/${weekStartDate}/slots?${qs}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
