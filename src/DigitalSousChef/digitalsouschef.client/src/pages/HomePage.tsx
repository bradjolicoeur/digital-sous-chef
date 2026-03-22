import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Wand2, History, CheckCircle, Loader2 } from 'lucide-react';
import { importRecipe, getRecipes } from '../api/recipes';
import RecipeCard from '../components/RecipeCard';
import type { RecipeSummary } from '../types';

const HomePage = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentRecipes, setRecentRecipes] = useState<RecipeSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getRecipes().then(recipes => setRecentRecipes(recipes.slice(0, 3))).catch(() => {});
  }, []);

  const handleImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const recipe = await importRecipe(url.trim());
      navigate(`/recipe/${recipe.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import recipe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pt-32 px-6 max-w-5xl mx-auto space-y-20 pb-24">
      <section className="flex flex-col items-center text-center space-y-8">
        <div className="space-y-4 max-w-2xl">
          <h1 className="font-headline text-5xl lg:text-6xl text-on-surface leading-tight">
            Add to your <span className="italic text-primary">Library</span>
          </h1>
          <p className="font-body text-on-surface-variant text-lg leading-relaxed">
            Simply paste a recipe URL from any site. Our AI will strip the clutter and save the soul of the dish.
          </p>
        </div>

        <div className="w-full max-w-2xl bg-surface-container-lowest p-6 lg:p-10 rounded-xl editorial-shadow border border-outline-variant/20">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant/50">
                <span className="text-lg">🔗</span>
              </div>
              <input
                className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-on-surface placeholder-on-surface-variant/40"
                placeholder="https://your-favorite-recipe.com/dish"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              />
            </div>
            <button
              onClick={handleImport}
              disabled={loading}
              className="bg-primary hover:bg-primary-container text-white px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-60"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Wand2 size={20} />}
              <span>{loading ? 'Scanning...' : 'Scan URL'}</span>
            </button>
          </div>
          {error && (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          )}
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-on-surface-variant/60 font-medium">
            <div className="flex items-center gap-2"><CheckCircle size={14} /> No ads</div>
            <div className="flex items-center gap-2"><CheckCircle size={14} /> Clean formatting</div>
            <div className="flex items-center gap-2"><CheckCircle size={14} /> Instant import</div>
          </div>
        </div>
      </section>

      {recentRecipes.length > 0 && (
        <section className="space-y-8">
          <div className="flex items-end justify-between border-b border-outline-variant/10 pb-4">
            <div className="flex items-center gap-3">
              <History className="text-primary" size={32} />
              <h2 className="font-headline text-3xl text-on-surface">Recent Scans</h2>
            </div>
            <Link to="/gallery" className="text-primary font-semibold flex items-center gap-1 hover:underline">
              View Gallery <ArrowRight size={18} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recentRecipes.map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

export default HomePage;
