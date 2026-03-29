import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Minus, Check, Trash2, Share2, ShoppingBasket, X } from 'lucide-react';
import {
  getGroceryList,
  addItem as apiAddItem,
  updateItem,
  removeItem,
  clearPurchased,
} from '../api/grocery';
import type { GroceryList, GroceryItem } from '../types';


// Splits "1.5 cups peanut butter" → { amount: "1.5 cups", ingredientName: "peanut butter" }
function parseIngredient(name: string): { amount: string; ingredientName: string } {
  // Match a leading number (integer, decimal, fraction, unicode fraction, or mixed like "1½" / "1 1/2")
  const numMatch = name.match(
    /^([¼½¾⅓⅔⅛⅜⅝⅞]|\d+[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[./]\d+)?(?:\s+\d+\/\d+)?(?:\s*[-–]\s*\d+(?:[./]\d+)?)?)\s+(.+)$/
  );
  if (!numMatch) return { amount: '', ingredientName: name };

  const num = numMatch[1];
  const rest = numMatch[2];

  // Check if rest starts with a measurement unit
  const unitMatch = rest.match(
    /^(cups?|c\.|tablespoons?|tbsp\.?|tbs\.?|teaspoons?|tsp\.?|pounds?|lbs?\.?|ounces?|oz\.?|grams?|g\.|kilograms?|kg\.?|liters?|litres?|milliliters?|ml\.?|quarts?|qt\.?|pints?|pt\.?|gallons?|slices?|pieces?|cloves?|cans?|packages?|pkg\.?|bunches?|heads?|stalks?|sprigs?|dashes?|pinches?|handfuls?|sticks?|loaves?|links?|strips?|sheets?|drops?|bags?|jars?)\s+(.+)$/i
  );

  if (unitMatch) {
    return { amount: `${num} ${unitMatch[1]}`, ingredientName: unitMatch[2] };
  }

  return { amount: num, ingredientName: rest };
}

const GroceryListPage = () => {
  const [list, setList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickAdd, setQuickAdd] = useState('');
  const [activeStore, setActiveStore] = useState<string | null>(null); // null = Master List
  const newStoreInputRef = useRef<HTMLInputElement>(null);
  const [showNewStoreInput, setShowNewStoreInput] = useState(false);
  const [extraStores, setExtraStores] = useState<string[]>([]); // stores created via UI before items assigned

  const loadList = useCallback(() => {
    setLoading(true);
    getGroceryList().then(setList).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const handleTogglePurchased = async (item: GroceryItem) => {
    if (!list) return;
    const updated = await updateItem(item.id, { isPurchased: !item.isPurchased });
    setList(updated);
  };

  const handleQuantityChange = async (item: GroceryItem, delta: number) => {
    if (!list) return;
    const newQty = Math.max(0, item.quantity + delta);
    const updated = await updateItem(item.id, { quantity: newQty });
    setList(updated);
  };

  const handleRemoveItem = async (item: GroceryItem) => {
    if (!list) return;
    const updated = await removeItem(item.id);
    setList(updated);
  };

  const handleAssignStore = async (item: GroceryItem, store: string) => {
    if (!list) return;
    const updated = await updateItem(item.id, { store: store || undefined });
    setList(updated);
  };

  const handleAddStore = () => {
    const name = (newStoreInputRef.current?.value ?? '').trim();
    if (!name || allStores.includes(name)) return;
    setExtraStores(prev => [...prev, name]);
    setActiveStore(name);
    if (newStoreInputRef.current) newStoreInputRef.current.value = '';
    setShowNewStoreInput(false);
  };

  const handleShareList = async () => {
    if (!list || activeStore === null) return;
    const storeItems = list.items.filter(i => i.store === activeStore);
    const text = storeItems
      .map(i => {
        const { amount, ingredientName } = parseIngredient(i.name);
        return `${i.quantity}x ${ingredientName || i.name}${amount ? ` (${amount})` : ''}`;
      })
      .join('\n');
    try {
      if (navigator.share) await navigator.share({ title: `${activeStore} Shopping List`, text });
      else await navigator.clipboard.writeText(text);
    } catch { /* user cancelled */ }
  };

  const handleQuickAdd = async () => {
    if (!list || !quickAdd.trim()) return;
    const updated = await apiAddItem(quickAdd.trim(), 1, activeStore ?? undefined);
    setList(updated);
    setQuickAdd('');
  };

  const handleClearPurchased = async () => {
    if (!list || activeStore === null) return;
    const updated = await clearPurchased(activeStore);
    setList(updated);
  };

  // Stores that have at least one item assigned to them
  const assignedStores = [...new Set(
    (list?.items ?? []).map(i => i.store).filter((s): s is string => !!s)
  )].sort();

  // All tabs: Master List + assigned stores + any extra (newly created, not yet populated)
  const allStores = [...new Set([...assignedStores, ...extraStores])].sort();

  // Items for current view
  const viewItems = activeStore === null
    ? (list?.items ?? []).filter(i => !i.store)         // Master List = unassigned
    : (list?.items ?? []).filter(i => i.store === activeStore); // Store view = matched store

  // Group viewItems by category
  const grouped = viewItems.reduce<Record<string, GroceryItem[]>>((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryColors: Record<string, string> = {
    Produce: 'bg-green-100 text-green-800',
    Protein: 'bg-red-100 text-red-800',
    Dairy: 'bg-blue-100 text-blue-800',
    Grains: 'bg-amber-100 text-amber-800',
    Spices: 'bg-orange-100 text-orange-800',
    Condiments: 'bg-yellow-100 text-yellow-800',
    Other: 'bg-gray-100 text-gray-800',
  };

  if (loading) {
    return <div className="pt-32 text-center text-on-surface-variant">Loading grocery list...</div>;
  }

  if (!list || list.items.length === 0) {
    return (
      <main className="pt-24 pb-32 px-4 md:px-8 max-w-screen-2xl mx-auto min-h-screen flex flex-col items-center justify-center">
        <div className="text-center max-w-lg">
          <div className="w-24 h-24 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-8">
            <ShoppingBasket size={36} className="text-primary/40" />
          </div>
          <h2 className="font-headline text-3xl italic text-on-surface mb-4">Your list is waiting</h2>
          <p className="text-on-surface-variant mb-8 leading-relaxed">
            Generate a grocery list from your weekly meal plan or add items manually below.
          </p>
          <div className="flex items-center gap-3 max-w-md mx-auto">
            <input
              type="text"
              value={quickAdd}
              onChange={e => setQuickAdd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
              placeholder="Add an item..."
              className="flex-1 px-5 py-3 rounded-full border border-outline-variant/30 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
            <button
              onClick={handleQuickAdd}
              className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-24 pb-32 px-4 md:px-8 max-w-screen-2xl mx-auto min-h-screen">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row justify-between md:items-end gap-6">
        <div>
          <h1 className="font-headline text-5xl text-on-surface tracking-tight leading-none mb-4">The Provisions</h1>
          <p className="font-headline italic text-xl text-on-surface-variant">
            {viewItems.filter(i => !i.isPurchased).length} item{viewItems.filter(i => !i.isPurchased).length !== 1 ? 's' : ''} remaining
            {activeStore ? ` at ${activeStore}` : ' in master list'}
          </p>
        </div>
        {/* Store-view-only header actions */}
        {activeStore !== null && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleShareList}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <Share2 size={14} />
              Share List
            </button>
            {viewItems.some(i => i.isPurchased) && (
              <button
                onClick={handleClearPurchased}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
              >
                <Trash2 size={14} />
                Clear Completed
              </button>
            )}
          </div>
        )}
      </header>

      {/* Store Tabs */}
      <div className="mb-8 flex items-center gap-2 flex-wrap">
        {/* Master List tab */}
        <button
          onClick={() => setActiveStore(null)}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
            activeStore === null
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          Master List
          <span className="ml-2 text-xs opacity-70">
            {(list?.items ?? []).filter(i => !i.store).length}
          </span>
        </button>

        {/* Store tabs */}
        {allStores.map(store => (
          <button
            key={store}
            onClick={() => setActiveStore(store)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeStore === store
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {store}
            <span className="ml-2 text-xs opacity-70">
              {(list?.items ?? []).filter(i => i.store === store).length}
            </span>
          </button>
        ))}

        {/* Add new store */}
        {showNewStoreInput ? (
          <div className="flex items-center gap-2">
            <input
              ref={newStoreInputRef}
              type="text"
              defaultValue=""
              onKeyDown={e => { if (e.key === 'Enter') handleAddStore(); if (e.key === 'Escape') setShowNewStoreInput(false); }}
              placeholder="Store name..."
              autoFocus
              className="px-4 py-1.5 rounded-full text-sm border border-outline-variant/30 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 w-40"
            />
            <button onClick={handleAddStore} className="px-4 py-1.5 rounded-full bg-primary text-white text-sm font-semibold">Add</button>
            <button onClick={() => setShowNewStoreInput(false)} className="px-3 py-1.5 rounded-full text-sm text-on-surface-variant hover:bg-surface-container-high">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewStoreInput(true)}
            className="px-4 py-2 rounded-full text-sm text-on-surface-variant border border-dashed border-outline-variant/30 hover:bg-surface-container-high transition-colors flex items-center gap-1"
          >
            <Plus size={14} />
            New Store
          </button>
        )}
      </div>

      {/* Quick Add */}
      <div className="mb-10 flex items-center gap-3 max-w-lg">
        <input
          type="text"
          value={quickAdd}
          onChange={e => setQuickAdd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
          placeholder={activeStore ? `Add item to ${activeStore}...` : 'Quick add item...'}
          className="flex-1 px-5 py-3 rounded-full border border-outline-variant/30 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
        <button
          onClick={handleQuickAdd}
          className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 active:scale-95 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Empty state for current view */}
      {viewItems.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          {activeStore === null
            ? 'All items have been assigned to stores.'
            : `No items in ${activeStore} yet. Add one above or assign from the master list.`}
        </div>
      )}

      {/* Categories grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/5">
            <div className="flex items-center gap-3 mb-5">
              <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${categoryColors[category] || categoryColors.Other}`}>
                {category}
              </span>
              <span className="text-xs text-on-surface-variant">{items.length}</span>
            </div>
            <div className="space-y-4">
              {items.map(item => {
                const { amount, ingredientName } = parseIngredient(item.name);
                return (
                  <div key={item.id} className="group">
                    {/* Line 1: action button + ingredient name */}
                    <div className="flex items-center gap-3">
                      {activeStore === null ? (
                        /* Master List: trash/delete button */
                        <button
                          onClick={() => handleRemoveItem(item)}
                          className="w-6 h-6 rounded-full border-2 border-outline-variant/30 flex items-center justify-center shrink-0 text-error hover:bg-error-container hover:border-error transition-colors"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X size={11} />
                        </button>
                      ) : (
                        /* Store view: purchased checkbox */
                        <button
                          onClick={() => handleTogglePurchased(item)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            item.isPurchased
                              ? 'bg-primary/20 border-primary/40'
                              : 'border-outline-variant/30 hover:border-primary'
                          }`}
                        >
                          {item.isPurchased && <Check size={12} className="text-primary" />}
                        </button>
                      )}
                      <span className={`text-sm font-semibold transition-all ${
                        activeStore !== null && item.isPurchased
                          ? 'line-through text-on-surface-variant/40'
                          : 'text-on-surface'
                      }`}>
                        {ingredientName || item.name}
                      </span>
                    </div>

                    {/* Line 2: amount + quantity + controls */}
                    <div className="flex items-center gap-2 mt-0.5 ml-9">
                      {amount && (
                        <span className={`text-xs transition-all ${
                          activeStore !== null && item.isPurchased
                            ? 'line-through text-on-surface-variant/30'
                            : 'text-on-surface-variant'
                        }`}>
                          {amount}
                        </span>
                      )}
                      <span className={`text-xs font-medium transition-all ${
                        activeStore !== null && item.isPurchased
                          ? 'text-on-surface-variant/30'
                          : 'text-error/80'
                      }`}>
                        {item.quantity}x
                      </span>

                      {/* Store assignment dropdown */}
                      <select
                        value={item.store ?? ''}
                        onChange={e => handleAssignStore(item, e.target.value)}
                        className="ml-1 text-xs text-on-surface-variant bg-transparent border-none focus:outline-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Assign to store"
                      >
                        <option value="">Master List</option>
                        {allStores.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>

                      {/* Quantity stepper + remove (show on hover) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                        <button
                          onClick={() => handleQuantityChange(item, -1)}
                          className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center"
                        >
                          <Minus size={9} />
                        </button>
                        <button
                          onClick={() => handleQuantityChange(item, 1)}
                          className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center"
                        >
                          <Plus size={9} />
                        </button>
                        {activeStore !== null && (
                          <button
                            onClick={() => handleRemoveItem(item)}
                            className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-error hover:bg-error-container transition-colors ml-1"
                            aria-label={`Remove ${item.name}`}
                          >
                            <X size={9} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};

export default GroceryListPage;
