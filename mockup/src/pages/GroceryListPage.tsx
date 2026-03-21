import React from 'react';
import { ShoppingBasket, Plus, Trash2, Share2, Leaf, Egg, BakeryDining } from 'lucide-react';

export function GroceryListPage() {
  return (
    <main className="pt-32 pb-32 px-6 max-w-7xl mx-auto">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="font-headline text-5xl md:text-6xl text-on-surface tracking-tight mb-4">Grocery List</h1>
          <p className="font-headline italic text-xl text-on-surface-variant">Gather your essentials for the week's curated menu.</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-surface-container-high text-on-surface-variant text-sm font-medium hover:bg-surface-container-highest transition-all">
            <Trash2 size={18} />
            Clear Completed
          </button>
          <button className="flex items-center gap-2 px-8 py-3 rounded-full bg-primary text-on-primary text-sm font-medium shadow-lg hover:bg-primary-container transition-all scale-100 active:scale-95">
            <Share2 size={18} />
            Share List
          </button>
        </div>
      </header>

      <section className="mb-16">
        <div className="bg-surface-container-low p-2 rounded-2xl flex items-center gap-4 border border-outline-variant/10">
          <div className="flex-1 flex items-center px-4">
            <ShoppingBasket className="text-primary/60 mr-3" size={24} />
            <input 
              className="w-full bg-transparent border-none focus:ring-0 text-lg font-body placeholder:text-stone-400" 
              placeholder="Add quick item (e.g., 2 Avocado)..." 
              type="text"
            />
          </div>
          <button className="bg-primary text-white p-4 rounded-xl shadow-md hover:brightness-110 transition-all">
            <Plus size={24} />
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="font-headline text-2xl font-semibold flex items-center gap-2">
              <Leaf className="text-primary" size={24} />
              Produce
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container px-2 py-1 rounded">3 Items</span>
          </div>
          <div className="space-y-3">
            <GroceryItem name="Heirloom Tomatoes" note="Vine-ripened preferred" quantity={2} />
            <GroceryItem name="Fresh Basil" note="Large bunch" quantity={1} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="font-headline text-2xl font-semibold flex items-center gap-2">
              <Egg className="text-primary" size={24} />
              Dairy & Chilled
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container px-2 py-1 rounded">2 Items</span>
          </div>
          <div className="space-y-3">
            <GroceryItem name="Buffalo Mozzarella" note="DOP Certified" quantity={2} />
            <GroceryItem name="Heavy Cream" note="500ml" quantity={1} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="font-headline text-2xl font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">bakery_dining</span>
              Pantry
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container px-2 py-1 rounded">1 Item</span>
          </div>
          <div className="space-y-3">
            <GroceryItem name="Arborio Rice" note="For Risotto" quantity={1} />
          </div>
        </div>
      </div>

      <section className="mt-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-[1px] flex-1 bg-outline-variant/20"></div>
          <h3 className="font-headline text-2xl italic text-on-surface-variant px-4">Purchased Items</h3>
          <div className="h-[1px] flex-1 bg-outline-variant/20"></div>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-6 border border-dashed border-outline-variant/40">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center justify-between opacity-50 bg-white/40 p-3 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-primary text-white flex items-center justify-center">
                  <Plus size={14} className="rotate-45" />
                </div>
                <span className="line-through text-on-surface">Sea Salt</span>
              </div>
              <span className="text-[10px] font-bold">1 unit</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function GroceryItem({ name, note, quantity }: { name: string; note: string; quantity: number }) {
  return (
    <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex items-center justify-between group hover:shadow-md transition-all border border-outline-variant/5">
      <div className="flex items-center gap-4">
        <div className="w-6 h-6 rounded border-2 border-outline-variant/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"></div>
        <div>
          <p className="text-on-surface font-medium text-sm">{name}</p>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-tight">{note}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-surface-container-low rounded-full px-2 py-1">
        <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white transition-colors text-primary"><Plus size={14} className="rotate-45" /></button>
        <span className="w-4 text-center font-bold text-xs">{quantity}</span>
        <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white transition-colors text-primary"><Plus size={14} /></button>
      </div>
    </div>
  );
}
