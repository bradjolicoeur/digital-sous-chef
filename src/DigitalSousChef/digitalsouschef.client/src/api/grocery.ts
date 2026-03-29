import type { GroceryList } from '../types';

const BASE = '/api/grocery';

export async function getGroceryList(): Promise<GroceryList> {
  const res = await fetch(BASE, { credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateList(weekStartDate: string): Promise<GroceryList> {
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ weekStartDate }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addItem(name: string, quantity = 1, store?: string): Promise<GroceryList> {
  const res = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, quantity, ...(store ? { store } : {}) }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addItemsBulk(recipeId: string): Promise<GroceryList> {
  const res = await fetch(`${BASE}/items/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ recipeId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateItem(
  itemId: string,
  updates: { isPurchased?: boolean; quantity?: number; store?: string }
): Promise<GroceryList> {
  const res = await fetch(`${BASE}/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function removeItem(itemId: string): Promise<GroceryList> {
  const res = await fetch(`${BASE}/items/${itemId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function clearPurchased(store?: string): Promise<GroceryList> {
  const url = store
    ? `${BASE}/items?purchased=true&store=${encodeURIComponent(store)}`
    : `${BASE}/items?purchased=true`;
  const res = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
