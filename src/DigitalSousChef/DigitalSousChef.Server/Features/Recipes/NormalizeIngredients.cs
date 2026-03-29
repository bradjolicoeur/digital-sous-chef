using System.Text.RegularExpressions;

namespace DigitalSousChef.Server.Features.Recipes;

public record NormalizeIngredientsCommand(List<string> Ingredients);
public record NormalizeIngredientsResult(List<string> Ingredients);

public class NormalizeIngredientsHandler
{
    public static NormalizeIngredientsResult Handle(NormalizeIngredientsCommand cmd) =>
        new(cmd.Ingredients.Select(NormalizeIngredient).ToList());

    // Maps decimal fraction → fraction string
    private static readonly (double Value, string Fraction)[] CommonFractions =
    [
        (1.0 / 8,  "1/8"),
        (1.0 / 4,  "1/4"),
        (1.0 / 3,  "1/3"),
        (3.0 / 8,  "3/8"),
        (1.0 / 2,  "1/2"),
        (5.0 / 8,  "5/8"),
        (2.0 / 3,  "2/3"),
        (3.0 / 4,  "3/4"),
        (7.0 / 8,  "7/8"),
    ];

    // Unit aliases: abbreviation → (singular, plural)
    private static readonly Dictionary<string, (string Singular, string Plural)> UnitAliases =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["tsp"]  = ("teaspoon",     "teaspoons"),
            ["tsps"] = ("teaspoon",     "teaspoons"),
            ["tbsp"] = ("tablespoon",   "tablespoons"),
            ["tbsps"]= ("tablespoon",   "tablespoons"),
            ["tbs"]  = ("tablespoon",   "tablespoons"),
            ["c"]    = ("cup",          "cups"),
            ["oz"]   = ("ounce",        "ounces"),
            ["ozs"]  = ("ounce",        "ounces"),
            ["fl oz"]= ("fluid ounce",  "fluid ounces"),
            ["lb"]   = ("pound",        "pounds"),
            ["lbs"]  = ("pound",        "pounds"),
            ["g"]    = ("gram",         "grams"),
            ["kg"]   = ("kilogram",     "kilograms"),
            ["ml"]   = ("milliliter",   "milliliters"),
            ["mL"]   = ("milliliter",   "milliliters"),
            ["l"]    = ("liter",        "liters"),
            ["L"]    = ("liter",        "liters"),
            ["pt"]   = ("pint",         "pints"),
            ["pts"]  = ("pint",         "pints"),
            ["qt"]   = ("quart",        "quarts"),
            ["qts"]  = ("quart",        "quarts"),
            ["gal"]  = ("gallon",       "gallons"),
            ["pkg"]  = ("package",      "packages"),
            ["pc"]   = ("piece",        "pieces"),
            ["pcs"]  = ("piece",        "pieces"),
        };

    // Matches a decimal number like 2.5 or 0.333
    private static readonly Regex DecimalPattern =
        new(@"(\d+)\.(\d+)", RegexOptions.Compiled);

    // Matches: optional leading number(s), optional space, then a known unit abbreviation at a word boundary
    // e.g. "2 tbsp" or "0.5tsp"  — unit captured in group 1, preceding quantity in group "qty"
    private static readonly Regex UnitTokenPattern =
        new(@"(?<qty>(?:\d+\s+)?\d+(?:[/\s]\d+)?)\s*(?<unit>tbsps?|tsps?|tbs|fl\s?oz|ozs?|lbs?|kgs?|mls?|mL|l\b|L\b|pts?|qts?|gals?|pkg|pcs?|g\b|c\b)",
            RegexOptions.Compiled);

    internal static string NormalizeIngredient(string ingredient)
    {
        if (string.IsNullOrWhiteSpace(ingredient)) return ingredient;

        // Step 1: replace decimal fractions with common fraction notation
        var result = DecimalPattern.Replace(ingredient, m =>
        {
            if (!double.TryParse(m.Value, System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out var d))
                return m.Value;

            var whole = Math.Truncate(d);
            var frac  = d - whole;

            // Whole number (e.g. 2.0 → 2)
            if (frac < 0.01) return ((int)whole).ToString();

            // Find closest common fraction
            var best = CommonFractions
                .Select(f => (f, diff: Math.Abs(f.Value - frac)))
                .Where(x => x.diff < 0.02)
                .OrderBy(x => x.diff)
                .Select(x => x.f)
                .FirstOrDefault();

            if (best == default) return m.Value;

            return whole > 0
                ? $"{(int)whole} {best.Fraction}"
                : best.Fraction;
        });

        // Step 2: expand unit abbreviations, choosing singular vs plural based on quantity
        result = UnitTokenPattern.Replace(result, m =>
        {
            var qtyStr = m.Groups["qty"].Value.Trim();
            var unit   = m.Groups["unit"].Value.Trim();

            if (!UnitAliases.TryGetValue(unit, out var names)) return m.Value;

            var qty = ParseQuantity(qtyStr);
            var expanded = qty > 1 ? names.Plural : names.Singular;
            return $"{qtyStr} {expanded}";
        });

        return result.Trim();
    }

    private static double ParseQuantity(string qty)
    {
        qty = qty.Trim();
        if (string.IsNullOrEmpty(qty)) return 0;

        // Mixed number: "1 1/2"
        var parts = qty.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 2
            && double.TryParse(parts[0], System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var whole)
            && TryParseFraction(parts[1], out var frac))
            return whole + frac;

        // Simple fraction: "1/2"
        if (parts.Length == 1 && TryParseFraction(parts[0], out var f)) return f;

        // Plain number
        if (double.TryParse(qty, System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var n))
            return n;

        return 0;
    }

    private static bool TryParseFraction(string s, out double result)
    {
        result = 0;
        var idx = s.IndexOf('/');
        if (idx < 0) return false;
        if (!double.TryParse(s[..idx], out var num)) return false;
        if (!double.TryParse(s[(idx + 1)..], out var den) || den == 0) return false;
        result = num / den;
        return true;
    }
}
