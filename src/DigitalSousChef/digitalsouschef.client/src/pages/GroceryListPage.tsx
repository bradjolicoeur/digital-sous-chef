import { useState, useEffect, useCallback } from 'react';
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

  const handleQuickAdd = async () => {
    if (!list || !quickAdd.trim()) return;
    const updated = await apiAddItem(quickAdd.trim());
    setList(updated);
    setQuickAdd('');
  };

  const handleClearPurchased = async () => {
    if (!list) return;
    const updated = await clearPurchased();
    setList(updated);
  };

  const handleRemoveItem = async (item: GroceryItem) => {
    if (!list) return;
    const updated = await removeItem(item.id);
    setList(updated);
  };

  const activeItems = list?.items.filter(i => !i.isPurchased) ?? [];

  // Group ALL items by category (purchased stay in place, styled differently)
  const grouped = (list?.items ?? []).reduce<Record<string, GroceryItem[]>>((acc, item) => {
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
      <header className="mb-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
        <div>
          <h1 className="font-headline text-5xl text-on-surface tracking-tight leading-none mb-4">The Provisions</h1>
          <p className="font-headline italic text-xl text-on-surface-variant">
            {activeItems.length} item{activeItems.length !== 1 ? 's' : ''} remaining
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <Share2 size={14} />
            Share List
          </button>
          {activeItems.length < (list?.items.length ?? 0) && (
            <button
              onClick={handleClearPurchased}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
            >
              <Trash2 size={14} />
              Clear Completed
            </button>
          )}
        </div>
      </header>

      {/* Quick Add */}
      <div className="mb-10 flex items-center gap-3 max-w-lg">
        <input
          type="text"
          value={quickAdd}
          onChange={e => setQuickAdd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
          placeholder="Quick add item..."
          className="flex-1 px-5 py-3 rounded-full border border-outline-variant/30 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
        <button
          onClick={handleQuickAdd}
          className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 active:scale-95 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

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
                    {/* Line 1: checkbox + ingredient name */}
                    <div className="flex items-center gap-3">
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
                      <span className={`text-sm font-semibold transition-all ${
                        item.isPurchased ? 'line-through text-on-surface-variant/40' : 'text-on-surface'
                      }`}>
                        {ingredientName || item.name}
                      </span>
                    </div>
                    {/* Line 2: amount + quantity, controls on hover */}
                    <div className="flex items-center gap-2 mt-0.5 ml-9">
                      {amount && (
                        <span className={`text-xs transition-all ${
                          item.isPurchased ? 'line-through text-on-surface-variant/30' : 'text-on-surface-variant'
                        }`}>
                          {amount}
                        </span>
                      )}
                      <span className={`text-xs font-medium transition-all ${
                        item.isPurchased ? 'text-on-surface-variant/30' : 'text-error/80'
                      }`}>
                        {item.quantity}x
                      </span>
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
                        <button
                          onClick={() => handleRemoveItem(item)}
                          className="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-error hover:bg-error-container transition-colors ml-1"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X size={9} />
                        </button>
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
