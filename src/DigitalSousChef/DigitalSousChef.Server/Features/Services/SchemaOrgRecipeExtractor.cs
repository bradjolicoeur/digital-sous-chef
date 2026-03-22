using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using DigitalSousChef.Server.Features.Recipes;

namespace DigitalSousChef.Server.Features.Services;

/// <summary>
/// Extracts recipe data by parsing Schema.org JSON-LD structured data embedded in recipe pages.
/// Almost every major recipe site (AllRecipes, Serious Eats, NYT Cooking, Epicurious, etc.)
/// includes this markup. Falls back to basic title/description extraction if not found.
/// </summary>
public partial class SchemaOrgRecipeExtractor : IAIRecipeExtractor
{
    private readonly HttpClient _httpClient;

    public SchemaOrgRecipeExtractor(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
        // Mimic a real browser so sites don't serve bot-detection pages.
        // Accept-Encoding is handled automatically by the handler (AutomaticDecompression).
        _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        _httpClient.DefaultRequestHeaders.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        _httpClient.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en-US,en;q=0.9");
        // Accept-Encoding is injected automatically by the HttpClientHandler (AutomaticDecompression = All)
    }

    public async Task<Recipe> ExtractAsync(string url)
    {
        // Validate URL scheme to prevent SSRF against internal services
        var uri = new Uri(url);
        if (uri.Scheme != "https" && uri.Scheme != "http")
            throw new ArgumentException("Only http/https URLs are supported.");

        using var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var html = await response.Content.ReadAsStringAsync();

        var recipe = TryExtractFromJsonLd(html, url);
        if (recipe != null) return recipe;

        return BasicExtract(html, url);
    }

    // ── JSON-LD parsing ───────────────────────────────────────────────────────

    private Recipe? TryExtractFromJsonLd(string html, string url)
    {
        foreach (Match scriptMatch in JsonLdScriptRegex().Matches(html))
        {
            try
            {
                using var doc = JsonDocument.Parse(scriptMatch.Groups[1].Value);
                var root = doc.RootElement;

                // Pattern 1: root is an array
                if (root.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in root.EnumerateArray())
                    {
                        var r = TryMapRecipeElement(item, url);
                        if (r != null) return r;
                    }
                }
                else if (root.ValueKind == JsonValueKind.Object)
                {
                    // Pattern 2: @graph array (common on WordPress / Yoast sites)
                    if (root.TryGetProperty("@graph", out var graph) && graph.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in graph.EnumerateArray())
                        {
                            var r = TryMapRecipeElement(item, url);
                            if (r != null) return r;
                        }
                    }

                    // Pattern 3: direct Recipe object
                    var direct = TryMapRecipeElement(root, url);
                    if (direct != null) return direct;
                }
            }
            catch { /* skip blocks that fail to parse */ }
        }
        return null;
    }

    private static Recipe? TryMapRecipeElement(JsonElement el, string url)
    {
        if (el.ValueKind != JsonValueKind.Object) return null;
        if (!el.TryGetProperty("@type", out var typeEl)) return null;

        bool isRecipe = typeEl.ValueKind == JsonValueKind.String
            ? typeEl.GetString()?.Equals("Recipe", StringComparison.OrdinalIgnoreCase) == true
            : typeEl.ValueKind == JsonValueKind.Array &&
              typeEl.EnumerateArray().Any(t => t.GetString()?.Equals("Recipe", StringComparison.OrdinalIgnoreCase) == true);

        if (!isRecipe) return null;

        // ── Times ──
        var prepMin  = ParseIsoDuration(GetString(el, "prepTime"));
        var cookMin  = ParseIsoDuration(GetString(el, "cookTime"));
        var totalMin = ParseIsoDuration(GetString(el, "totalTime"))
                       ?? ((prepMin.HasValue || cookMin.HasValue)
                           ? (prepMin ?? 0) + (cookMin ?? 0)
                           : (int?)null);
        var displayMinutes = totalMin ?? prepMin;

        // ── Servings ──
        var yieldStr = GetString(el, "recipeYield");
        if (yieldStr == null && el.TryGetProperty("recipeYield", out var yieldEl) && yieldEl.ValueKind == JsonValueKind.Array)
            yieldStr = yieldEl.EnumerateArray().Select(e => e.GetString()).FirstOrDefault(s => s != null);
        var servingsValue = ExtractLeadingNumber(yieldStr);
        var servings = servingsValue.HasValue ? $"{servingsValue} Persons" : (yieldStr?.Trim() ?? "");

        // ── Category ──
        var rawCategory = GetString(el, "recipeCategory") ?? "";
        // recipeCategory can be a comma-list; take first non-empty token
        var category = rawCategory.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                                  .FirstOrDefault() ?? "Dinner";

        // ── Tags ──
        var tags = new List<string> { "Imported" };
        var cuisine = GetString(el, "recipeCuisine");
        if (!string.IsNullOrWhiteSpace(cuisine))
            tags.AddRange(cuisine.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        if (el.TryGetProperty("keywords", out var kwEl))
        {
            var kwStr = kwEl.ValueKind == JsonValueKind.String ? kwEl.GetString() : null;
            if (kwStr != null)
                tags.AddRange(kwStr.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(6));
        }

        // ── Ingredients ──
        var ingredients = new List<Ingredient>();
        if (el.TryGetProperty("recipeIngredient", out var ingEl) && ingEl.ValueKind == JsonValueKind.Array)
            foreach (var ing in ingEl.EnumerateArray())
            {
                var text = ing.GetString();
                if (!string.IsNullOrWhiteSpace(text))
                    ingredients.Add(new Ingredient(WebUtility.HtmlDecode(text), null));
            }
        if (ingredients.Count == 0)
            ingredients.Add(new Ingredient("See original recipe for ingredients", null));

        // ── Instructions ──
        var instructions = new List<InstructionStep>();
        if (el.TryGetProperty("recipeInstructions", out var instrEl))
            instructions = ParseInstructions(instrEl);
        if (instructions.Count == 0)
            instructions.Add(new InstructionStep("Visit Source", $"See the original recipe at {url}"));

        // ── Nutrition ──
        int? caloriesValue = null;
        string caloriesStr = "";
        if (el.TryGetProperty("nutrition", out var nutrition))
        {
            var calStr = GetString(nutrition, "calories");
            caloriesValue = ExtractLeadingNumber(calStr);
            caloriesStr = caloriesValue.HasValue ? $"{caloriesValue} kcal" : (calStr ?? "");
        }

        // ── Image ──
        var imageUrl = ExtractImageUrl(el);

        // ── Macros ──
        int? protein = null, carbs = null, fat = null;
        if (el.TryGetProperty("nutrition", out var n2))
        {
            protein = ExtractLeadingNumber(GetString(n2, "proteinContent"));
            carbs   = ExtractLeadingNumber(GetString(n2, "carbohydrateContent"));
            fat     = ExtractLeadingNumber(GetString(n2, "fatContent"));
        }

        return new Recipe
        {
            SourceUrl    = url,
            Title        = WebUtility.HtmlDecode(GetString(el, "name") ?? "Imported Recipe"),
            Description  = WebUtility.HtmlDecode(GetString(el, "description") ?? ""),
            ImageUrl     = imageUrl,
            Category     = category,
            Difficulty   = Difficulty.Medium,
            PrepTime     = displayMinutes.HasValue ? FormatDuration(displayMinutes.Value) : "",
            PrepTimeMinutes  = displayMinutes,
            Calories     = caloriesStr,
            CaloriesValue    = caloriesValue,
            Servings     = servings,
            ServingsValue    = servingsValue,
            Tags         = tags.Distinct().Take(8).ToList(),
            Ingredients  = ingredients,
            Instructions = instructions,
            ProteinGrams = protein,
            CarbGrams    = carbs,
            FatGrams     = fat,
        };
    }

    // ── Instruction parsing ───────────────────────────────────────────────────

    private static List<InstructionStep> ParseInstructions(JsonElement el)
    {
        var steps = new List<InstructionStep>();

        if (el.ValueKind == JsonValueKind.String)
        {
            var text = el.GetString();
            if (!string.IsNullOrWhiteSpace(text))
                steps.Add(new InstructionStep("Instructions", WebUtility.HtmlDecode(text)));
            return steps;
        }

        if (el.ValueKind != JsonValueKind.Array) return steps;

        int stepNum = 1;
        foreach (var item in el.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String)
            {
                var text = item.GetString();
                if (!string.IsNullOrWhiteSpace(text))
                    steps.Add(new InstructionStep($"Step {stepNum++}", WebUtility.HtmlDecode(text)));
            }
            else if (item.ValueKind == JsonValueKind.Object)
            {
                var itemType = GetString(item, "@type") ?? "";
                if (itemType.Equals("HowToSection", StringComparison.OrdinalIgnoreCase))
                {
                    // Recurse into section's itemListElement
                    if (item.TryGetProperty("itemListElement", out var sectionItems))
                    {
                        var inner = ParseInstructions(sectionItems);
                        // Re-number from current stepNum
                        foreach (var s in inner)
                        {
                            steps.Add(s.Title.StartsWith("Step ") ? s with { Title = $"Step {stepNum++}" } : s);
                        }
                    }
                }
                else // HowToStep or untyped object
                {
                    var text = GetString(item, "text") ?? GetString(item, "name") ?? "";
                    var name = GetString(item, "name");
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        var title = !string.IsNullOrWhiteSpace(name) && !name!.Equals(text, StringComparison.Ordinal)
                            ? name!
                            : $"Step {stepNum}";
                        steps.Add(new InstructionStep(title, WebUtility.HtmlDecode(text)));
                        stepNum++;
                    }
                }
            }
        }
        return steps;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static string ExtractImageUrl(JsonElement el)
    {
        if (!el.TryGetProperty("image", out var img)) return "";
        return img.ValueKind switch
        {
            JsonValueKind.String => img.GetString() ?? "",
            JsonValueKind.Object => GetString(img, "url") ?? "",
            JsonValueKind.Array  => img.EnumerateArray()
                .Select(i => i.ValueKind == JsonValueKind.String ? i.GetString()
                           : i.ValueKind == JsonValueKind.Object ? GetString(i, "url") : null)
                .FirstOrDefault(s => !string.IsNullOrEmpty(s)) ?? "",
            _ => ""
        };
    }

    /// <summary>Parses ISO 8601 duration (e.g. PT1H30M) into total minutes.</summary>
    private static int? ParseIsoDuration(string? iso)
    {
        if (string.IsNullOrWhiteSpace(iso)) return null;
        var m = IsoDurationRegex().Match(iso);
        if (!m.Success) return null;
        int minutes = 0;
        if (m.Groups["h"].Success) minutes += int.Parse(m.Groups["h"].Value) * 60;
        if (m.Groups["m"].Success) minutes += int.Parse(m.Groups["m"].Value);
        return minutes > 0 ? minutes : null;
    }

    private static string FormatDuration(int minutes) => minutes switch
    {
        < 60 => $"{minutes} min",
        _    => minutes % 60 == 0 ? $"{minutes / 60} hr" : $"{minutes / 60} hr {minutes % 60} min"
    };

    private static int? ExtractLeadingNumber(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var m = LeadingNumberRegex().Match(text);
        return m.Success ? int.Parse(m.Value) : null;
    }

    private static string? GetString(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    // ── Fallback ──────────────────────────────────────────────────────────────

    private static Recipe BasicExtract(string html, string url)
    {
        var titleMatch = TitleTagRegex().Match(html);
        var title = titleMatch.Success ? titleMatch.Groups[1].Value.Trim() : "Imported Recipe";

        // Look for og:description for a cleaner description
        var ogDesc = OgDescRegex().Match(html);
        string description;
        if (ogDesc.Success)
        {
            description = WebUtility.HtmlDecode(ogDesc.Groups[1].Value.Trim());
        }
        else
        {
            var plain = HtmlTagRegex().Replace(html, " ");
            plain = WhitespaceRegex().Replace(plain, " ").Trim();
            description = plain.Length > 300 ? plain[..300] + "..." : plain;
        }

        // Try og:image
        var ogImage = OgImageRegex().Match(html);
        var imageUrl = ogImage.Success ? WebUtility.HtmlDecode(ogImage.Groups[1].Value.Trim()) : "";

        return new Recipe
        {
            SourceUrl    = url,
            Title        = WebUtility.HtmlDecode(title),
            Description  = description,
            ImageUrl     = imageUrl,
            Category     = "Dinner",
            Difficulty   = Difficulty.Medium,
            Tags         = ["Imported"],
            Ingredients  = [new Ingredient("See original recipe for ingredients", null)],
            Instructions = [new InstructionStep("Visit Source", $"See the original recipe at {url}")]
        };
    }

    // ── Compiled regexes ─────────────────────────────────────────────────────

    [GeneratedRegex(@"<script[^>]+type=""application/ld\+json""[^>]*>(.*?)</script>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex JsonLdScriptRegex();

    [GeneratedRegex(@"PT(?:(?<h>\d+)H)?(?:(?<m>\d+)M)?", RegexOptions.IgnoreCase)]
    private static partial Regex IsoDurationRegex();

    [GeneratedRegex(@"^\d+")]
    private static partial Regex LeadingNumberRegex();

    [GeneratedRegex(@"<title[^>]*>(.*?)</title>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex TitleTagRegex();

    [GeneratedRegex(@"<meta[^>]+property=""og:description""[^>]+content=""([^""]*)""", RegexOptions.IgnoreCase)]
    private static partial Regex OgDescRegex();

    [GeneratedRegex(@"<meta[^>]+property=""og:image""[^>]+content=""([^""]*)""", RegexOptions.IgnoreCase)]
    private static partial Regex OgImageRegex();

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex HtmlTagRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
