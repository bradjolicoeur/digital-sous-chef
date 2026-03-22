# Digital Sous Chef — Implementation Spec

## Table of Contents

1. [Overview](#1-overview)
2. [Navigation Structure](#2-navigation-structure)
3. [Data Models](#3-data-models)
4. [Feature Specifications](#4-feature-specifications)
   - [4.1 Home — URL Recipe Import](#41-home--url-recipe-import)
   - [4.2 Gallery](#42-gallery)
   - [4.3 Recipe Detail](#43-recipe-detail)
   - [4.4 Meal Planner](#44-meal-planner)
   - [4.5 Grocery List](#45-grocery-list)
5. [Authentication](#5-authentication)
6. [Backend API](#6-backend-api)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Backend Architecture](#8-backend-architecture)
9. [Out of Scope (v1)](#9-out-of-scope-v1)

---

## 1. Overview

Digital Sous Chef is a recipe management and meal planning app. The core loop is:

1. **Import** a recipe by pasting a URL — the backend fetches and parses it with AI.
2. **Browse** the saved recipe library (Gallery) and view recipe details.
3. **Plan** meals for the week on the Planner, assigning recipes to breakfast/lunch/dinner slots.
4. **Shop** — generate and manage a grocery list derived from the week's planned meals.

**Stack summary:**

| Layer | Technology |
|---|---|
| Backend | .NET 10 / ASP.NET Core, Wolverine, Marten (PostgreSQL) |
| Orchestration | .NET Aspire |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router v7 |
| Auth | FusionAuth (OIDC / OAuth 2.0 with PKCE) |
| AI | External LLM/scraping service (called from backend handler) |

---

## 2. Navigation Structure

### Routes

| Route | Page | Notes |
|---|---|---|
| `/` | Home | URL import + recent recipes |
| `/gallery` | Gallery | All recipes, search, filter |
| `/gallery/:category` | Gallery (filtered) | Breakfast, Lunch, Dinner, Desserts, Snacks |
| `/recipe/:id` | Recipe Detail | Full recipe view |
| `/planner` | Meal Planner | Weekly calendar grid |
| `/grocery` | Grocery List | Auto-generated + manual items |
| `/profile` | Profile | (v1 stub) |

### Layout Rules

- **Top nav** (always visible): Logo → Home, links to Gallery / Planner / Grocery List, Plus / Heart / User icon buttons.
- **Side nav** (desktop only, Gallery & Planner routes): Category links — Breakfast, Lunch, Dinner, Desserts, Snacks — plus "New Collection", Settings, Support.
- **Bottom nav** (mobile only, hidden on Recipe Detail): Gallery, Planner, floating `+` (Home), Grocery, Profile.

---

## 3. Data Models

### 3.1 `Recipe` (Marten document)

```csharp
public class Recipe
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";    // FusionAuth user ID (subject claim)
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string ImageUrl { get; set; } = "";
    public string SourceUrl { get; set; } = "";       // original URL that was imported
    public string PrepTime { get; set; } = "";        // human-readable, e.g. "20 min"
    public int? PrepTimeMinutes { get; set; }         // parsed numeric for sorting
    public string Calories { get; set; } = "";        // human-readable, e.g. "380 kcal"
    public int? CaloriesValue { get; set; }           // parsed numeric for nutrition totals
    public string Servings { get; set; } = "";        // human-readable, e.g. "2 Persons"
    public int? ServingsValue { get; set; }
    public Difficulty Difficulty { get; set; }
    public string Category { get; set; } = "";        // Breakfast | Lunch | Dinner | Desserts | Snacks | Side
    public List<string> Tags { get; set; } = [];      // Vegan | Vegetarian | Gluten-Free | Pescatarian | Healthy | ...
    public List<Ingredient> Ingredients { get; set; } = [];
    public List<InstructionStep> Instructions { get; set; } = [];
    public bool IsFavorite { get; set; }
    public DateTimeOffset ImportedAt { get; set; }
    // Nutrition (optional, populated if available from source or AI)
    public int? ProteinGrams { get; set; }
    public int? CarbGrams { get; set; }
    public int? FatGrams { get; set; }
}

public record Ingredient(string Item, string? Note);

public record InstructionStep(string Title, string Text);

public enum Difficulty { Easy, Medium, Intermediate, Expert }
```

### 3.2 `MealPlan` (Marten document)

One `MealPlan` document per calendar week. The week is keyed by the `Monday` date.

```csharp
public class MealPlan
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";    // FusionAuth user ID (subject claim)
    public DateOnly WeekStartDate { get; set; }   // always the Monday of the week
    public List<MealSlot> Slots { get; set; } = [];
}

public record MealSlot(
    DateOnly Date,
    MealType MealType,    // Breakfast | Lunch | Dinner
    Guid RecipeId,
    string RecipeTitle,   // denormalised for display
    string RecipeImageUrl // denormalised for display
);

public enum MealType { Breakfast, Lunch, Dinner }
```

### 3.3 `GroceryList` (Marten document)

One active `GroceryList` per user/session. Can be regenerated from the current week's meal plan.

```csharp
public class GroceryList
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";    // FusionAuth user ID (subject claim)
    public DateOnly ForWeek { get; set; }           // the WeekStartDate this was generated from
    public List<GroceryItem> Items { get; set; } = [];
}

public class GroceryItem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string? Note { get; set; }
    public int Quantity { get; set; } = 1;
    public string Category { get; set; } = "";      // Produce | Dairy & Chilled | Pantry | Meat | Seafood | Other
    public bool IsPurchased { get; set; }
    public Guid? SourceRecipeId { get; set; }       // null for manually-added items
}
```

---

## 4. Feature Specifications

### 4.1 Home — URL Recipe Import

**Page:** `/`

**Purpose:** The primary entry point. Users paste a recipe URL; the backend scrapes and parses it with AI, then stores the result as a `Recipe` document.

#### UI Elements

- Large headline: *"Add to your Library"*
- URL input field with placeholder `https://your-favorite-recipe.com/dish`
- **Scan URL** button (Wand icon)
- Trust indicators below the input: *No ads · Clean formatting · Instant import*
- **Recent Scans** section: horizontal row of the 3 most recently imported recipes displayed as `RecipeCard` (default variant), with a "View Gallery →" link

#### Behaviour

1. User pastes URL and clicks **Scan URL**.
2. Frontend `POST /api/recipes/import` with `{ url }`.
3. Backend:
   a. Fetches the page HTML.
   b. Calls AI to extract structured recipe data (title, description, ingredients, instructions, prep time, calories, servings, difficulty, category, tags, image URL).
   c. Stores the resulting `Recipe` document.
   d. Returns the new `Recipe` record.
4. Frontend navigates to `/recipe/{newId}` on success.
5. On error (invalid URL, parse failure), display an inline error message below the input.

#### Loading State
Show a spinner inside the **Scan URL** button and disable the input while the import is in progress.

---

### 4.2 Gallery

**Pages:** `/gallery`, `/gallery/:category`

**Purpose:** Browse the full recipe library with search and category filtering.

#### UI Elements

- Large editorial headline
- Full-width search bar (rounded, with magnifier icon)
- **Side nav** (desktop): category links filter the grid — Breakfast, Lunch, Dinner, Desserts, Snacks
- **Filter chips** (mobile, horizontal scroll): All Recipes | Vegetarian | Gluten-Free | Quick Meals
- **Recently Added** section: featured recipe card (`variant="featured"`, spans 2 columns) + remaining cards in a 4-column grid
- **All Recipes** section below: `variant="gallery"` cards in a 4-column grid (2 on mobile)

#### Behaviour

- The `category` route param (or selected chip on mobile) filters the grid to only recipes of that category.
- Search is client-side filtering of the already-fetched recipe list (debounced, 300 ms).
- Clicking a recipe navigates to `/recipe/:id`.
- Heart button on gallery cards toggles `IsFavorite` via `PATCH /api/recipes/:id/favorite`.

#### Data Loading

- `GET /api/recipes` — returns all recipes, ordered by `ImportedAt` descending.
- Optional query params: `category`, `search`.

---

### 4.3 Recipe Detail

**Page:** `/recipe/:id`

**Purpose:** Full recipe view — hero image, stats, ingredient checklist, step-by-step instructions.

#### UI Elements (Desktop — 12-column grid)

- **Left (5–6 cols):** Full-height hero image with rounded right corners. Floating stats bar overlaid at the bottom: Prep Time · Calories · Servings · Difficulty.
- **Right (6–7 cols):**
  - Breadcrumb: `Category • Tag`
  - Large italic title
  - Description paragraph
  - **Ingredients** section:
    - "Add all to list" button (ShoppingBasket icon) — adds all ingredients to the active grocery list
    - Checkbox list: each ingredient row has a checkbox, item name, optional note
  - **Preparation** section: numbered steps (circle avatar + step title + step text)
  - Action buttons: **Start Cooking Now** (primary) | **Share Recipe** (outline)

#### UI Elements (Mobile)

- Hero image (fixed height 512px, gradient overlay)
- Floating Favorite + Share buttons top-right
- Compact stats row (3 cards: prep time, calories, servings)
- Rest same as desktop

#### Behaviour

- Ingredient checkboxes are local state only (not persisted) — used to track progress while cooking.
- **Add all to list**: `POST /api/grocery/items/bulk` with the recipe's ingredient list.
- **Favorite / Share** buttons in the mobile overlay: same as gallery heart.
- Back navigation: chevron or browser back (no explicit back button in mockup, rely on nav).

---

### 4.4 Meal Planner

**Page:** `/planner`

**Purpose:** Weekly calendar where users assign recipes to meal slots (breakfast / lunch / dinner for each day).

#### UI Elements

- Header: "The Weekly Canvas" + italic subtitle with current week dates
- **Weekly / Monthly** toggle (only Weekly is in scope for v1)
- **Desktop grid** (7 columns × 3 rows = 21 slots):
  - Column headers: Monday–Sunday with date
  - Each slot: small meal-type label (Breakfast / Lunch / Dinner), then either:
    - A thumbnail image + recipe title (if a recipe is assigned), or
    - A `+` icon placeholder (empty, clickable to assign)
- **Mobile stack**: collapsible daily accordion cards showing assigned meals and empty slot placeholders
- **Right sidebar** (desktop, sticky):
  - **Daily Thresholds** panel: progress bar for Calories, mini bars for Carbs / Protein / Fats (summed from planned recipes for the selected day)
  - *Sous-Chef Tip* — AI-generated nudge (e.g., "You're short on protein…")
  - **Generate Grocery List** button

#### Behaviour

**Viewing**: The planner loads the `MealPlan` for the current week, defaulting to the current calendar week (Monday–Sunday).

**Assigning a recipe to a slot**:
1. User clicks the `+` in any empty slot.
2. A modal/drawer opens with a search-enabled list of their saved recipes.
3. User selects a recipe → `PUT /api/mealplan/{weekStartDate}/slots` with `{ date, mealType, recipeId }`.
4. Slot updates immediately (optimistic UI).

**Removing a recipe from a slot**:
- Long-press or hover reveals a remove ✕ button → `DELETE /api/mealplan/{weekStartDate}/slots/{slotId}`.

**Nutrition sidebar**:
- Totals are derived on the client from the `caloresValue`, `proteinGrams`, `carbGrams`, `fatGrams` fields of assigned recipes for the currently-selected day.
- Daily targets (2100 kcal, 200g carbs, 125g protein, 70g fat) are hardcoded constants in v1.

**Generate Grocery List**:
- `POST /api/grocery/generate` with `{ weekStartDate }`.
- Backend aggregates all ingredients from the week's planned recipes, deduplicates and categorises them, and creates (or replaces) the `GroceryList` for that week.
- Frontend navigates to `/grocery` on success.

---

### 4.5 Grocery List

**Page:** `/grocery`

**Purpose:** Manage a shopping list — auto-generated from the meal plan or manually edited.

#### UI Elements

- Header: "Grocery List" + subtitle
- **Clear Completed** button (removes all `IsPurchased` items via API)
- **Share List** button (native share sheet or clipboard copy of formatted list)
- **Quick-add input**: text field with `+` button — add a single free-text item
- **Items grid** (3 columns on desktop, 1 on mobile): grouped by category
  - Each group header: icon + category name + item count badge
  - Each item card:
    - Checkbox (toggling `IsPurchased`)
    - Item name + note
    - Quantity stepper (−/+)
- **Purchased Items** section at the bottom: completed items shown crossed-out in a dashed container

#### Behaviour

- Load active grocery list: `GET /api/grocery`.
- **Quick-add**: `POST /api/grocery/items` with `{ name, quantity: 1 }`. Category defaults to "Other".
- **Check/uncheck item**: `PATCH /api/grocery/items/:itemId` with `{ isPurchased }`.
- **Change quantity**: `PATCH /api/grocery/items/:itemId` with `{ quantity }`.
- **Clear Completed**: `DELETE /api/grocery/items?purchased=true`.
- **Share List**: formats items as plain text and invokes the Web Share API or copies to clipboard.

---

## 5. Authentication

### Identity Provider

FusionAuth provides OIDC / OAuth 2.0 authentication. It runs as a Docker container managed by Aspire and is pre-configured via Kickstart on first boot.

| Setting | Value |
|---------|-------|
| Client ID | `e9fdb985-9173-4e01-9d73-ac2d60d1dc8e` |
| Tenant ID | `d7d09513-a3f5-401c-9685-34ab6c552453` |
| Issuer | `http://localhost:9011` (dev) |
| Grants | `authorization_code`, `refresh_token` |
| PKCE | Required |
| Scopes | `openid email profile offline_access` |

### Dev Users (provisioned automatically)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@digitalsouschef.local` | `password` |
| Regular user | `chef@example.com` | `password` |

### Frontend Flow

1. The React app wraps the entire component tree in `<FusionAuthProvider>` from `@fusionauth/react-sdk`.
2. Unauthenticated users are redirected to FusionAuth's hosted login page via `startLogin()`.
3. After login FusionAuth redirects back to the app; the SDK handles the PKCE callback and stores the access token in a secure cookie.
4. The token is automatically refreshed via `shouldAutoRefresh: true`.
5. Protected routes check `isLoggedIn` from `useFusionAuth()` and redirect to home if false.

```tsx
// src/main.tsx
const fusionAuthConfig: FusionAuthProviderConfig = {
  clientId: 'e9fdb985-9173-4e01-9d73-ac2d60d1dc8e',
  serverUrl: 'http://localhost:9011',
  redirectUri: 'http://localhost:5173',
  postLogoutRedirectUri: 'http://localhost:5173',
  scope: 'openid email profile offline_access',
  shouldAutoRefresh: true,
  shouldAutoFetchUserInfo: true,
};
```

### Backend JWT Validation

Every API endpoint (except health checks) requires a valid JWT issued by FusionAuth.

```csharp
// Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.Authority = builder.Configuration["FusionAuth:Issuer"]; // from Aspire env var
        opts.Audience = "e9fdb985-9173-4e01-9d73-ac2d60d1dc8e";
        opts.TokenValidationParameters.ValidIssuer = builder.Configuration["FusionAuth:Issuer"];
    });

builder.Services.AddAuthorization();

// After app.Build():
app.UseAuthentication();
app.UseAuthorization();
```

The `services__fusionauth-app__http__0` Aspire environment variable is mapped to `FusionAuth:Issuer` in `appsettings.json` / `appsettings.Development.json`.

### User Identity in Handlers

Handlers extract the authenticated user's ID from the JWT subject claim via `IHttpContextAccessor`:

```csharp
// Resolved from the 'sub' claim of the JWT
public static string GetUserId(IHttpContextAccessor ctx) =>
    ctx.HttpContext!.User.FindFirstValue(ClaimTypes.NameIdentifier)
    ?? throw new UnauthorizedAccessException();
```

All documents (`Recipe`, `MealPlan`, `GroceryList`) are **scoped to the authenticated user** — handlers always filter queries by `UserId` and set `UserId` on newly created documents.

### Route Protection

- All `/api/*` routes require `[Authorize]` (applied globally via `RequireAuthorization()` on `app.MapWolverineEndpoints()`).
- Frontend protected pages check `isLoggedIn` from the SDK hook and call `startLogin()` if false.

---

## 6. Backend API

All routes are implemented with `WolverineHttp` attributes and require authentication. Commands/queries co-located with handlers in `Features/`.

### 5.1 Recipes

| Method | Route | Handler | Description |
|---|---|---|---|
| `POST` | `/api/recipes/import` | `ImportRecipeHandler` | Scrape URL, AI-extract, store recipe |
| `GET` | `/api/recipes` | `GetRecipesHandler` | List all recipes (supports `?category=&search=`) |
| `GET` | `/api/recipes/{id}` | `GetRecipeHandler` | Single recipe by ID |
| `PATCH` | `/api/recipes/{id}/favorite` | `ToggleFavoriteHandler` | Toggle `IsFavorite` |
| `DELETE` | `/api/recipes/{id}` | `DeleteRecipeHandler` | Remove a recipe |

**`ImportRecipeCommand`**
```csharp
public record ImportRecipeCommand(string Url);
// Returns: Recipe (the fully persisted document)
```

**`GetRecipesQuery`**
```csharp
public record GetRecipesQuery(string? Category, string? Search);
// Returns: List<RecipeSummary>

public record RecipeSummary(
    Guid Id, string Title, string Description, string ImageUrl,
    string PrepTime, string Calories, string Servings,
    Difficulty Difficulty, string Category, List<string> Tags,
    bool IsFavorite, DateTimeOffset ImportedAt
);
```

---

### 5.2 Meal Planner

| Method | Route | Handler | Description |
|---|---|---|---|
| `GET` | `/api/mealplan/{weekStartDate}` | `GetMealPlanHandler` | Load week plan (creates empty if missing) |
| `PUT` | `/api/mealplan/{weekStartDate}/slots` | `AssignMealSlotHandler` | Assign recipe to a slot |
| `DELETE` | `/api/mealplan/{weekStartDate}/slots/{slotId}` | `RemoveMealSlotHandler` | Remove a slot assignment |

**`AssignMealSlotCommand`**
```csharp
public record AssignMealSlotCommand(
    DateOnly WeekStartDate,
    DateOnly Date,
    MealType MealType,
    Guid RecipeId
);
```

---

### 5.3 Grocery List

| Method | Route | Handler | Description |
|---|---|---|---|
| `GET` | `/api/grocery` | `GetGroceryListHandler` | Active grocery list |
| `POST` | `/api/grocery/generate` | `GenerateGroceryListHandler` | Generate from meal plan week |
| `POST` | `/api/grocery/items` | `AddGroceryItemHandler` | Add a single item |
| `POST` | `/api/grocery/items/bulk` | `AddGroceryItemsBulkHandler` | Add items from a recipe |
| `PATCH` | `/api/grocery/items/{itemId}` | `UpdateGroceryItemHandler` | Update purchased/quantity |
| `DELETE` | `/api/grocery/items` | `ClearPurchasedItemsHandler` | `?purchased=true` clears completed |

**`GenerateGroceryListCommand`**
```csharp
public record GenerateGroceryListCommand(DateOnly WeekStartDate);
// Backend logic:
// 1. Load MealPlan for week
// 2. For each slot, load Recipe and collect ingredients
// 3. Deduplicate by normalised ingredient name
// 4. Categorise ingredients (Produce, Dairy & Chilled, Meat, Seafood, Pantry, Other)
// 5. Store/replace GroceryList document for the week
// Returns: GroceryList
```

---

## 7. Frontend Architecture

### File Structure

```
src/
  api/
    recipes.ts          # importRecipe, getRecipes, getRecipe, toggleFavorite, deleteRecipe
    planner.ts          # getMealPlan, assignSlot, removeSlot
    grocery.ts          # getGroceryList, generateList, addItem, updateItem, clearPurchased
  components/
    BottomNavBar.tsx
    RecipeCard.tsx       # variants: default | featured | gallery
    SideNavBar.tsx
    TopNavBar.tsx
    RecipePickerModal.tsx  # modal for choosing recipe when assigning to planner slot
  pages/
    HomePage.tsx
    GalleryPage.tsx
    RecipeDetailPage.tsx
    PlannerPage.tsx
    GroceryListPage.tsx
  types.ts              # TypeScript types mirroring backend DTOs
  App.tsx               # Router + AppLayout
```
  auth/
    AuthGuard.tsx       # wraps protected routes; redirects to login if not authenticated

### `types.ts`

TypeScript types must match the backend DTO shapes exactly:

```typescript
export type Difficulty = 'Easy' | 'Medium' | 'Intermediate' | 'Expert';
export type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

export interface Ingredient {
  item: string;
  note?: string;
}

export interface InstructionStep {
  title: string;
  text: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  sourceUrl: string;
  prepTime: string;
  prepTimeMinutes?: number;
  calories: string;
  caloriesValue?: number;
  servings: string;
  servingsValue?: number;
  difficulty: Difficulty;
  category: string;
  tags: string[];
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  isFavorite: boolean;
  importedAt: string;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
}

export interface RecipeSummary {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  prepTime: string;
  calories: string;
  servings: string;
  difficulty: Difficulty;
  category: string;
  tags: string[];
  isFavorite: boolean;
  importedAt: string;
}

export interface MealSlot {
  id: string;
  date: string;           // ISO date string
  mealType: MealType;
  recipeId: string;
  recipeTitle: string;
  recipeImageUrl: string;
}

export interface MealPlan {
  id: string;
  weekStartDate: string;  // ISO date string (Monday)
  slots: MealSlot[];
}

export interface GroceryItem {
  id: string;
  name: string;
  note?: string;
  quantity: number;
  category: string;
  isPurchased: boolean;
  sourceRecipeId?: string;
}

export interface GroceryList {
  id: string;
  forWeek: string;        // ISO date string
  items: GroceryItem[];
}
```

### `FusionAuthProvider` setup

Wrap the app in `<FusionAuthProvider>` in `src/main.tsx` (see Section 5 for config values). Use `AuthGuard` to protect pages that require login:

```tsx
// src/auth/AuthGuard.tsx
import { useFusionAuth } from '@fusionauth/react-sdk';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isLoading } = useFusionAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoading && !isLoggedIn) navigate('/');
  }, [isLoggedIn, isLoading, navigate]);
  if (isLoading || !isLoggedIn) return null;
  return <>{children}</>;
};

export default AuthGuard;
```

All pages except Home are wrapped in `<AuthGuard>` in `App.tsx`.

### API module pattern

All API calls include `credentials: 'include'` so the browser sends the FusionAuth session cookie (the SDK stores tokens as cookies):

```typescript
// src/api/recipes.ts
const BASE = '/api/recipes';

export async function importRecipe(url: string): Promise<Recipe> {
  const res = await fetch(`${BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRecipes(params?: { category?: string; search?: string }): Promise<RecipeSummary[]> {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  const res = await fetch(`${BASE}${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
// ... etc (all fetch calls use credentials: 'include')
```

### State management

Use React's built-in `useState` + `useEffect` with loading/error state per page. No global state library required for v1. Extract shared data-fetching logic into custom hooks where the same data is needed on multiple pages (e.g., `useRecipes()`).

---

## 8. Backend Architecture

### Feature folder layout

```
Features/
  Recipes/
    Recipe.cs                     # Document + Ingredient + InstructionStep + Difficulty
    RecipeEndpoints.cs            # WolverineHttp endpoint definitions
    ImportRecipe.cs               # ImportRecipeCommand + ImportRecipeHandler (calls AI)
    GetRecipes.cs                 # GetRecipesQuery + handler
    GetRecipe.cs                  # GetRecipeQuery + handler
    ToggleFavorite.cs             # ToggleFavoriteCommand + handler
    DeleteRecipe.cs               # DeleteRecipeCommand + handler
  MealPlanner/
    MealPlan.cs                   # MealPlan document + MealSlot + MealType
    PlannerEndpoints.cs
    GetMealPlan.cs
    AssignMealSlot.cs
    RemoveMealSlot.cs
  GroceryList/
    GroceryList.cs                # GroceryList document + GroceryItem
    GroceryEndpoints.cs
    GetGroceryList.cs
    GenerateGroceryList.cs        # aggregates ingredients from meal plan
    AddGroceryItem.cs
    AddGroceryItemsBulk.cs
    UpdateGroceryItem.cs
    ClearPurchasedItems.cs
```

### `ImportRecipeHandler` — AI integration

The handler fetches the page, strips HTML, and sends the plain text to an AI model to extract structured data. Wire the AI client (e.g., `HttpClient` calling an OpenAI-compatible endpoint, or a configured `IAIRecipeExtractor` abstraction) as a constructor or static parameter dependency.

```csharp
public class ImportRecipeHandler
{
    public static async Task<Recipe> Handle(
        ImportRecipeCommand cmd,
        IAIRecipeExtractor extractor,
        IDocumentSession session)
    {
        var recipe = await extractor.ExtractAsync(cmd.Url);
        recipe.Id = Guid.NewGuid();
        recipe.ImportedAt = DateTimeOffset.UtcNow;
        session.Store(recipe);
        await session.SaveChangesAsync();
        return recipe;
    }
}
```

`IAIRecipeExtractor` implementation steps:
1. `HttpClient` GET the URL (follow redirects, 30 s timeout).
2. Strip HTML to plain text (HtmlAgilityPack or similar).
3. POST to OpenAI Chat Completions with a structured JSON schema prompt.
4. Deserialise the response into a `Recipe` object.
5. Download and re-host the recipe image (optional; v1 can store the original URL).

### `GenerateGroceryListHandler`

```csharp
public class GenerateGroceryListHandler
{
    public static async Task<GroceryList> Handle(
        GenerateGroceryListCommand cmd,
        IDocumentSession session,
        IIngredientCategoriser categoriser)
    {
        // 1. Load the meal plan
        var plan = await session.Query<MealPlan>()
            .FirstOrDefaultAsync(p => p.WeekStartDate == cmd.WeekStartDate);

        // 2. Collect recipe IDs from slots
        var recipeIds = plan?.Slots.Select(s => s.RecipeId).Distinct().ToList() ?? [];

        // 3. Bulk load recipes
        var recipes = await session.Query<Recipe>()
            .Where(r => r.Id.IsOneOf(recipeIds))
            .ToListAsync();

        // 4. Aggregate and deduplicate ingredients
        var allIngredients = recipes.SelectMany(r => r.Ingredients).ToList();
        // Deduplication by normalised item name is handled by IIngredientCategoriser

        // 5. Categorise and build GroceryList
        var items = categoriser.Categorise(allIngredients);

        var groceryList = new GroceryList
        {
            Id = Guid.NewGuid(),
            ForWeek = cmd.WeekStartDate,
            Items = items
        };

        // 6. Replace any existing list for this week
        session.DeleteWhere<GroceryList>(g => g.ForWeek == cmd.WeekStartDate);
        session.Store(groceryList);
        await session.SaveChangesAsync();

        return groceryList;
    }
}
```

### Marten configuration (`Program.cs`)

```csharp
builder.Services.AddMarten(opts =>
{
    opts.Connection(builder.Configuration.GetConnectionString("marten")!);
    opts.DatabaseSchemaName = "souschef";
    opts.Events.AppendMode = EventAppendMode.Quick;
    opts.AutoCreateSchemaObjects = AutoCreate.CreateOrUpdate;
})
.UseLightweightSessions()
.UseNpgsqlDataSource()
.IntegrateWithWolverine();
```

### Wolverine configuration (`Program.cs`)

```csharp
builder.Host.UseWolverine(opts =>
{
    opts.Policies.AutoApplyTransactions();
    opts.Policies.UseDurableLocalQueues();
});
builder.Services.AddWolverineHttp();
```

---

## 9. Out of Scope (v1)

The following features are visible in the mockup UI but are deferred:

| Feature | Notes |
|---|---|
| Collections / folders | "New Collection" button in sidebar is a stub |
| Monthly planner view | Toggle exists; only Weekly is implemented |
| Settings page | Nav link present; no implementation needed |
| Support page | Nav link present; no implementation needed |
| Profile page | Bottom nav tab; stub page only |
| Image re-hosting | Store original image URL from source; no upload/CDN |
| Nutritional data for manually-added items | Grocery items added via quick-add have no nutrition data |
| Sous-Chef AI tip generation | Tip panel on Planner is static text in v1 |
