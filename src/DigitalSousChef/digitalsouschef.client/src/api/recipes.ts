import type { Recipe, RecipeSummary } from '../types';

const BASE = '/api/recipes';

export async function importRecipe(url: string): Promise<Recipe> {
  const res = await fetch(`${BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function importRecipeFromText(rawText: string): Promise<Recipe> {
  const res = await fetch(`${BASE}/import/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ rawText }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRecipes(params?: { category?: string; search?: string }): Promise<RecipeSummary[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.search) qs.set('search', params.search);
  const query = qs.toString();
  const res = await fetch(`${BASE}${query ? `?${query}` : ''}`, { credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRecipe(id: string): Promise<Recipe> {
  const res = await fetch(`${BASE}/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function toggleFavorite(id: string): Promise<Recipe> {
  const res = await fetch(`${BASE}/${id}/favorite`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteRecipe(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function createRecipe(data: Omit<Recipe, 'id' | 'importedAt' | 'isFavorite'>): Promise<Recipe> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateRecipe(id: string, data: Omit<Recipe, 'id' | 'importedAt' | 'isFavorite'>): Promise<Recipe> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
