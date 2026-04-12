import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wand2, Loader2, CheckCircle, Link2, FileText, LogIn } from 'lucide-react';
import { useFusionAuth } from '@fusionauth/react-sdk';
import { importRecipe, importRecipeFromText } from '../api/recipes';
import { cn } from '../lib/utils';

const PENDING_IMPORT_KEY = 'pendingImport';

type Tab = 'url' | 'text';

interface PendingImport {
  tab: Tab;
  value: string;
}

const RecipeImportScanner = () => {
  const [tab, setTab] = useState<Tab>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { isLoggedIn, startLogin } = useFusionAuth();

  // Restore and auto-submit a pending import saved before login redirect
  useEffect(() => {
    if (!isLoggedIn) return;
    const raw = sessionStorage.getItem(PENDING_IMPORT_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_IMPORT_KEY);
    try {
      const pending: PendingImport = JSON.parse(raw);
      setTab(pending.tab);
      if (pending.tab === 'url') setUrl(pending.value);
      else setText(pending.value);
      // Auto-trigger import after state settles
      const value = pending.value.trim();
      if (!value) return;
      setLoading(true);
      setError('');
      const importFn = pending.tab === 'url'
        ? importRecipe(value)
        : importRecipeFromText(value);
      importFn
        .then(recipe => navigate(`/recipe/${recipe.id}`))
        .catch(err => setError(err instanceof Error ? err.message : 'Failed to import recipe'))
        .finally(() => setLoading(false));
    } catch {
      // Malformed session data — ignore
    }
  }, [isLoggedIn, navigate]);

  const handleImport = async () => {
    if (!isLoggedIn) {
      const value = tab === 'url' ? url : text;
      sessionStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify({ tab, value }));
      sessionStorage.setItem('postLoginRedirect', '/');
      startLogin();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const recipe = tab === 'url'
        ? await importRecipe(url.trim())
        : await importRecipeFromText(text.trim());
      navigate(`/recipe/${recipe.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import recipe');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = tab === 'url' ? url.trim().length > 0 : text.trim().length > 0;

  return (
    <div className="w-full max-w-2xl bg-surface-container-lowest p-6 lg:p-10 rounded-xl editorial-shadow border border-outline-variant/20">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-container-low rounded-full p-1">
        <button
          onClick={() => setTab('url')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full text-sm font-medium transition-all',
            tab === 'url' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-on-surface'
          )}
        >
          <Link2 size={15} /> Paste URL
        </button>
        <button
          onClick={() => setTab('text')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full text-sm font-medium transition-all',
            tab === 'text' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-on-surface'
          )}
        >
          <FileText size={15} /> Paste Text
        </button>
      </div>

      {tab === 'url' ? (
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
              onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleImport()}
            />
          </div>
          <button
            onClick={handleImport}
            disabled={loading || !canSubmit}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-60"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : isLoggedIn ? <Wand2 size={20} /> : <LogIn size={20} />}
            <span>{loading ? 'Scanning...' : isLoggedIn ? 'Scan URL' : 'Sign in to Import'}</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <textarea
            className="w-full p-4 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-on-surface placeholder-on-surface-variant/40 resize-none font-body text-sm leading-relaxed"
            placeholder={"Paste your recipe here...\n\nIngredients\n- 2 cups flour\n- 1 cup sugar\n\nInstructions\n1. Mix ingredients\n2. Bake at 350°F"}
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
          />
          <button
            onClick={handleImport}
            disabled={loading || !canSubmit}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-60 self-end"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : isLoggedIn ? <Wand2 size={20} /> : <LogIn size={20} />}
            <span>{loading ? 'Importing...' : isLoggedIn ? 'Import Recipe' : 'Sign in to Import'}</span>
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex items-center justify-center gap-6 text-sm text-on-surface-variant/60 font-medium">
        <div className="flex items-center gap-2"><CheckCircle size={14} /> No ads</div>
        <div className="flex items-center gap-2"><CheckCircle size={14} /> Clean formatting</div>
        <div className="flex items-center gap-2"><CheckCircle size={14} /> Instant import</div>
      </div>
    </div>
  );
};

export default RecipeImportScanner;
