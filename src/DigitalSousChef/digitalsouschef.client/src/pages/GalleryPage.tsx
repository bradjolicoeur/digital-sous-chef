import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { getRecipes, toggleFavorite } from '../api/recipes';
import RecipeCard from '../components/RecipeCard';
import type { RecipeSummary } from '../types';

const GalleryPage = () => {
  const { category } = useParams<{ category?: string }>();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All Recipes');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getRecipes({ category }).then(setRecipes).finally(() => setLoading(false));
  }, [category]);

  const filtered = useMemo(() => {
    let result = recipes;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (activeFilter !== 'All Recipes') {
      result = result.filter(r =>
        r.tags.some(t => t.toLowerCase() === activeFilter.toLowerCase()) ||
        (activeFilter === 'Quick Meals' && r.prepTime.includes('min'))
      );
    }
    return result;
  }, [recipes, search, activeFilter]);

  const featuredRecipe = filtered[0];
  const otherRecipes = filtered.slice(1);

  const handleFavorite = async (id: string) => {
    const updated = await toggleFavorite(id);
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, isFavorite: updated.isFavorite } : r));
  };

  const filters = ['All Recipes', 'Vegetarian', 'Gluten-Free', 'Quick Meals'];

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 lg:px-12 py-12">
      <section className="mb-20">
        <h1 className="font-headline text-5xl md:text-7xl text-on-surface mb-8 max-w-2xl leading-tight">
          Find your <span className="italic text-primary font-medium">culinary</span> inspiration.
        </h1>
        <div className="relative max-w-3xl">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Search className="text-outline" size={24} />
          </div>
          <input
            className="w-full pl-16 pr-8 py-5 bg-surface-container-lowest border-none rounded-full editorial-shadow focus:ring-2 focus:ring-primary-container text-lg transition-all"
            placeholder="Search recipes, ingredients, or cuisines..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>

      {loading ? (
        <div className="text-center py-20 text-on-surface-variant">Loading recipes...</div>
      ) : (
        <>
          {featuredRecipe && (
            <section className="mb-24">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <span className="text-primary font-bold tracking-widest text-[10px] uppercase block mb-2">Curated Selection</span>
                  <h2 className="font-headline text-3xl text-on-surface">Recently Added</h2>
                </div>
                <Link to="/gallery" className="text-primary font-medium text-sm flex items-center gap-1 group">
                  View All <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <RecipeCard recipe={featuredRecipe} variant="featured" onFavorite={handleFavorite} />
                {otherRecipes.slice(0, 3).map(recipe => (
                  <RecipeCard key={recipe.id} recipe={recipe} onFavorite={handleFavorite} />
                ))}
              </div>
            </section>
          )}

          <section className="pb-32">
            <div className="flex items-center gap-4 mb-12 overflow-x-auto pb-4 no-scrollbar lg:hidden">
              {filters.map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-6 py-2 rounded-full text-sm whitespace-nowrap ${
                    activeFilter === f
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-12">
              {filtered.map(recipe => (
                <RecipeCard key={recipe.id} recipe={recipe} variant="gallery" onFavorite={handleFavorite} />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-20 text-on-surface-variant">
                <p className="text-xl font-headline">No recipes found</p>
                <p className="mt-2">Import a recipe from the home page to get started!</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default GalleryPage;
