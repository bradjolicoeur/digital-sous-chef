import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { createRecipe, getRecipe, updateRecipe } from '../api/recipes';
import type { Difficulty, Ingredient, InstructionStep } from '../types';

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Intermediate', 'Expert'];

const EMPTY_FORM = {
  title: '',
  description: '',
  imageUrl: '',
  sourceUrl: '',
  prepTime: '',
  prepTimeMinutes: undefined as number | undefined,
  calories: '',
  caloriesValue: undefined as number | undefined,
  servings: '',
  servingsValue: undefined as number | undefined,
  difficulty: 'Easy' as Difficulty,
  category: '',
  tags: [] as string[],
  ingredients: [{ item: '', note: '' }] as { item: string; note: string }[],
  instructions: [{ title: '', text: '' }] as { title: string; text: string }[],
  proteinGrams: undefined as number | undefined,
  carbGrams: undefined as number | undefined,
  fatGrams: undefined as number | undefined,
};

const RecipeEditPage = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getRecipe(id)
      .then(recipe => {
        setForm({
          title: recipe.title,
          description: recipe.description,
          imageUrl: recipe.imageUrl,
          sourceUrl: recipe.sourceUrl,
          prepTime: recipe.prepTime,
          prepTimeMinutes: recipe.prepTimeMinutes,
          calories: recipe.calories,
          caloriesValue: recipe.caloriesValue,
          servings: recipe.servings,
          servingsValue: recipe.servingsValue,
          difficulty: recipe.difficulty,
          category: recipe.category,
          tags: recipe.tags,
          ingredients: recipe.ingredients.map(i => ({ item: i.item, note: i.note ?? '' })),
          instructions: recipe.instructions.map(s => ({ title: s.title, text: s.text })),
          proteinGrams: recipe.proteinGrams,
          carbGrams: recipe.carbGrams,
          fatGrams: recipe.fatGrams,
        });
        setTagsInput(recipe.tags.join(', '));
      })
      .catch(() => setError('Failed to load recipe.'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  // Ingredients
  const updateIngredient = (i: number, field: 'item' | 'note', value: string) =>
    setForm(f => {
      const ingredients = [...f.ingredients];
      ingredients[i] = { ...ingredients[i], [field]: value };
      return { ...f, ingredients };
    });
  const addIngredient = () =>
    setForm(f => ({ ...f, ingredients: [...f.ingredients, { item: '', note: '' }] }));
  const removeIngredient = (i: number) =>
    setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }));

  // Instructions
  const updateInstruction = (i: number, field: 'title' | 'text', value: string) =>
    setForm(f => {
      const instructions = [...f.instructions];
      instructions[i] = { ...instructions[i], [field]: value };
      return { ...f, instructions };
    });
  const addInstruction = () =>
    setForm(f => ({ ...f, instructions: [...f.instructions, { title: '', text: '' }] }));
  const removeInstruction = (i: number) =>
    setForm(f => ({ ...f, instructions: f.instructions.filter((_, idx) => idx !== i) }));

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    set('tags', value.split(',').map(t => t.trim()).filter(Boolean));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        ingredients: form.ingredients
          .filter(i => i.item.trim())
          .map(i => ({ item: i.item, note: i.note || undefined }) as Ingredient),
        instructions: form.instructions
          .filter(s => s.title.trim() || s.text.trim())
          .map(s => ({ title: s.title, text: s.text }) as InstructionStep),
      };

      const saved = id ? await updateRecipe(id, payload) : await createRecipe(payload);
      navigate(`/recipe/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center py-40 text-on-surface-variant">Loading…</div>;
  }

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-10 pb-32">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-low transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-4xl font-headline italic text-on-surface">
          {isEditing ? 'Edit Recipe' : 'New Recipe'}
        </h1>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-error/10 border border-error/30 rounded-xl text-error text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Basic info */}
        <section className="space-y-4">
          <h2 className="text-lg font-headline font-semibold text-on-surface border-b border-outline-variant pb-2">Basic Info</h2>

          <div>
            <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Title *</label>
            <input
              required
              className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Caesar Salad"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Description</label>
            <textarea
              rows={3}
              className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface resize-none"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="A short description of this recipe…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Category</label>
              <input
                className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                value={form.category}
                onChange={e => set('category', e.target.value)}
                placeholder="e.g. Salads"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Difficulty</label>
              <select
                className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                value={form.difficulty}
                onChange={e => set('difficulty', e.target.value as Difficulty)}
              >
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Tags (comma-separated)</label>
            <input
              className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
              value={tagsInput}
              onChange={e => handleTagsChange(e.target.value)}
              placeholder="e.g. Vegetarian, Quick, Gluten-Free"
            />
          </div>
        </section>

        {/* Metrics */}
        <section className="space-y-4">
          <h2 className="text-lg font-headline font-semibold text-on-surface border-b border-outline-variant pb-2">Metrics</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Prep Time</label>
              <input
                className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                value={form.prepTime}
                onChange={e => set('prepTime', e.target.value)}
                placeholder="e.g. 30 min"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Prep Time (minutes)</label>
              <input
                type="number"
                min={0}
                className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                value={form.prepTimeMinutes ?? ''}
                onChange={e => set('prepTimeMinutes', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Calories</label>
              <input
                className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                value={form.calories}
                onChange={e => set('calories', e.target.value)}
                placeholder="e.g. 350 kcal"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Servings</label>
              <input
                className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                value={form.servings}
                onChange={e => set('servings', e.target.value)}
                placeholder="e.g. 4 servings"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Protein (g)</label>
              <input
                type="number"
                min={0}
                className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                value={form.proteinGrams ?? ''}
                onChange={e => set('proteinGrams', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Carbs (g)</label>
              <input
                type="number"
                min={0}
                className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                value={form.carbGrams ?? ''}
                onChange={e => set('carbGrams', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Fat (g)</label>
              <input
                type="number"
                min={0}
                className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                value={form.fatGrams ?? ''}
                onChange={e => set('fatGrams', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>
        </section>

        {/* Media & source */}
        <section className="space-y-4">
          <h2 className="text-lg font-headline font-semibold text-on-surface border-b border-outline-variant pb-2">Media & Source</h2>
          <div>
            <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Image URL</label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
              value={form.imageUrl}
              onChange={e => set('imageUrl', e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-outline uppercase tracking-widest mb-1">Source URL</label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
              value={form.sourceUrl}
              onChange={e => set('sourceUrl', e.target.value)}
              placeholder="https://…"
            />
          </div>
        </section>

        {/* Ingredients */}
        <section className="space-y-4">
          <h2 className="text-lg font-headline font-semibold text-on-surface border-b border-outline-variant pb-2">Ingredients</h2>
          <div className="space-y-3">
            {form.ingredients.map((ing, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <input
                    className="px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                    placeholder="Ingredient *"
                    value={ing.item}
                    onChange={e => updateIngredient(i, 'item', e.target.value)}
                  />
                  <input
                    className="px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                    placeholder="Note (optional)"
                    value={ing.note}
                    onChange={e => updateIngredient(i, 'note', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  className="mt-3 text-outline hover:text-error transition-colors"
                  disabled={form.ingredients.length === 1}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addIngredient}
            className="flex items-center gap-2 text-primary text-sm font-medium hover:underline"
          >
            <Plus size={16} /> Add Ingredient
          </button>
        </section>

        {/* Instructions */}
        <section className="space-y-4">
          <h2 className="text-lg font-headline font-semibold text-on-surface border-b border-outline-variant pb-2">Instructions</h2>
          <div className="space-y-6">
            {form.instructions.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-8 h-8 mt-3 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm">
                  {i + 1}
                </span>
                <div className="flex-1 space-y-2">
                  <input
                    className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                    placeholder="Step title (e.g. Prepare the dressing)"
                    value={step.title}
                    onChange={e => updateInstruction(i, 'title', e.target.value)}
                  />
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface resize-none"
                    placeholder="Describe this step…"
                    value={step.text}
                    onChange={e => updateInstruction(i, 'text', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeInstruction(i)}
                  className="mt-3 text-outline hover:text-error transition-colors"
                  disabled={form.instructions.length === 1}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addInstruction}
            className="flex items-center gap-2 text-primary text-sm font-medium hover:underline"
          >
            <Plus size={16} /> Add Step
          </button>
        </section>

        {/* Submit */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-4 bg-primary text-on-primary rounded-full font-semibold flex items-center gap-2 hover:bg-primary-container transition-all active:scale-95 shadow-lg disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Recipe'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-8 py-4 border border-outline-variant text-on-surface rounded-full font-semibold hover:bg-surface-container-low transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
};

export default RecipeEditPage;
