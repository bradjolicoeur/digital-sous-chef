import { useState, useEffect, useCallback } from 'react';
import { Plus, Minus, Check, Trash2, Share2, ShoppingBasket } from 'lucide-react';
import {
  getGroceryList,
  addItem as apiAddItem,
  updateItem,
  clearPurchased,
} from '../api/grocery';
import type { GroceryList, GroceryItem } from '../types';

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

  const activeItems = list?.items.filter(i => !i.isPurchased) ?? [];
  const purchasedItems = list?.items.filter(i => i.isPurchased) ?? [];

  // Group active items by category
  const grouped = activeItems.reduce<Record<string, GroceryItem[]>>((acc, item) => {
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
            {purchasedItems.length > 0 && ` · ${purchasedItems.length} purchased`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-outline-variant/20 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <Share2 size={14} />
            Share List
          </button>
          {purchasedItems.length > 0 && (
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
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => handleTogglePurchased(item)}
                      className="w-6 h-6 rounded-full border-2 border-outline-variant/30 flex items-center justify-center shrink-0 hover:border-primary transition-colors"
                    >
                      {item.isPurchased && <Check size={12} className="text-primary" />}
                    </button>
                    <span className="text-sm truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleQuantityChange(item, -1)}
                      className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="text-xs font-medium w-8 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(item, 1)}
                      className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Purchased Items */}
      {purchasedItems.length > 0 && (
        <section>
          <h2 className="font-headline text-2xl italic text-on-surface-variant/60 mb-4">Purchased Items</h2>
          <div className="bg-surface-container-low rounded-3xl p-6">
            <div className="space-y-3">
              {purchasedItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 text-on-surface-variant/50">
                  <button
                    onClick={() => handleTogglePurchased(item)}
                    className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"
                  >
                    <Check size={12} className="text-primary" />
                  </button>
                  <span className="text-sm line-through">{item.name}</span>
                  <span className="text-xs ml-auto">
                    {item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

export default GroceryListPage;
