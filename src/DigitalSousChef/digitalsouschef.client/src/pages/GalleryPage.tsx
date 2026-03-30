import { useState, useEffect } from 'react';
import { useParams, Link, NavLink } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { getRecipes, toggleFavorite } from '../api/recipes';
import RecipeCard from '../components/RecipeCard';
import { CATEGORIES } from '../lib/categories';
import type { RecipeSummary } from '../types';

const GalleryPage = () => {
  const { category } = useParams<{ category?: string }>();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Debounce search input — fires 400ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch from server on category or debounced search change
  useEffect(() => {
    setLoading(true);
    getRecipes({ category, search: debouncedSearch || undefined })
      .then(setRecipes)
      .finally(() => setLoading(false));
  }, [category, debouncedSearch]);

  const handleFavorite = async (id: string) => {
    const updated = await toggleFavorite(id);
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, isFavorite: updated.isFavorite } : r));
  };

  const mobileNavLinkClass = (isActive: boolean) =>
    `px-5 py-2 rounded-full text-sm whitespace-nowrap shrink-0 transition-colors ${
      isActive ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
    }`;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 lg:px-12 pt-24 pb-12">
      <section className="mb-20">
        {category ? (
          <h1 className="font-headline text-5xl md:text-7xl text-on-surface mb-8 max-w-2xl leading-tight">
            <span className="italic text-primary font-medium capitalize">{category}</span> recipes.
          </h1>
        ) : (
          <h1 className="font-headline text-5xl md:text-7xl text-on-surface mb-8 max-w-2xl leading-tight">
            Find your <span className="italic text-primary font-medium">culinary</span> inspiration.
          </h1>
        )}
        <div className="relative max-w-3xl">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Search className="text-outline" size={24} />
          </div>
          <input
            id="recipe-search"
            name="search"
            className="w-full pl-16 pr-8 py-5 bg-surface-container-lowest border-none rounded-full editorial-shadow focus:ring-2 focus:ring-primary-container text-lg transition-all"
            placeholder="Search recipes, ingredients, or cuisines..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>

      {/* Mobile category nav — matches the desktop sidebar */}
      <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar lg:hidden">
        <NavLink
          to="/gallery"
          end
          className={({ isActive }) => mobileNavLinkClass(isActive)}
        >
          All Recipes
        </NavLink>
        {CATEGORIES.map(cat => (
          <NavLink
            key={cat}
            to={`/gallery/${encodeURIComponent(cat.toLowerCase())}`}
            className={({ isActive }) => mobileNavLinkClass(isActive)}
          >
            {cat}
          </NavLink>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-on-surface-variant">Loading recipes...</div>
      ) : (
        <section className="pb-32">
          {(category || debouncedSearch) && (
            <div className="flex items-end justify-between mb-8">
              <p className="text-sm text-on-surface-variant">{recipes.length} recipe{recipes.length !== 1 ? 's' : ''} found</p>
              <Link to="/gallery" className="text-primary font-medium text-sm flex items-center gap-1 group">
                View All <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recipes.map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} onFavorite={handleFavorite} />
            ))}
          </div>

          {recipes.length === 0 && (
            <div className="text-center py-20 text-on-surface-variant">
              <p className="text-xl font-headline">No recipes found</p>
              <p className="mt-2">Import a recipe from the home page to get started!</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default GalleryPage;
