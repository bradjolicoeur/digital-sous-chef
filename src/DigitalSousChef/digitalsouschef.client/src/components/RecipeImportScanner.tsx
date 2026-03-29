import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wand2, Loader2, CheckCircle } from 'lucide-react';
import { importRecipe } from '../api/recipes';

const RecipeImportScanner = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
  );
};

export default RecipeImportScanner;
