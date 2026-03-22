import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { getRecipes } from '../api/recipes';
import type { RecipeSummary } from '../types';

interface RecipePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (recipe: RecipeSummary) => void;
}

const RecipePickerModal = ({ isOpen, onClose, onSelect }: RecipePickerModalProps) => {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getRecipes().then(setRecipes).finally(() => setLoading(false));
  }, [isOpen]);

  const filtered = recipes.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
          <h2 className="font-headline text-2xl">Choose a Recipe</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-low">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={18} />
            <input
              className="w-full pl-12 pr-4 py-3 bg-surface-container-low rounded-full text-sm focus:ring-2 focus:ring-primary/20 border-none"
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {loading && <p className="text-center text-on-surface-variant py-8">Loading...</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-on-surface-variant py-8">No recipes found</p>
          )}
          {filtered.map(recipe => (
            <button
              key={recipe.id}
              onClick={() => { onSelect(recipe); onClose(); }}
              className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-surface-container-low transition-colors text-left"
            >
              {recipe.imageUrl && (
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  className="w-14 h-14 rounded-lg object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{recipe.title}</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">{recipe.category} · {recipe.prepTime}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RecipePickerModal;
