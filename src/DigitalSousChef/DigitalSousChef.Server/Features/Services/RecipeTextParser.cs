using DigitalSousChef.Server.Features.Recipes;

namespace DigitalSousChef.Server.Features.Services;

/// <summary>
/// Parses a plain-text recipe blob into a structured Recipe.
/// Looks for common section headers (Ingredients, Instructions/Directions/Steps/Method)
/// to split the text. Everything before the first section header is treated as the
/// description; the title is the first non-empty line.
/// </summary>
public static class RecipeTextParser
{
    private static readonly string[] IngredientHeaders =
        ["ingredients", "ingredient list", "what you'll need", "you'll need", "you will need"];

    private static readonly string[] InstructionHeaders =
        ["instructions", "directions", "steps", "method", "preparation", "how to make", "procedure"];

    public static Recipe Parse(string rawText)
    {
        var lines = rawText
            .Split(["\r\n", "\r", "\n"], StringSplitOptions.None)
            .Select(l => l.Trim())
            .ToList();

        // Title = first non-empty line
        var title = lines.FirstOrDefault(l => l.Length > 0) ?? "Imported Recipe";

        int ingredientStart = -1, instructionStart = -1;

        for (var i = 0; i < lines.Count; i++)
        {
            var normalized = lines[i].TrimEnd(':', ' ').ToLowerInvariant();

            if (ingredientStart == -1 && IngredientHeaders.Any(h => normalized == h || normalized.StartsWith(h)))
                ingredientStart = i;
            else if (instructionStart == -1 && InstructionHeaders.Any(h => normalized == h || normalized.StartsWith(h)))
                instructionStart = i;
        }

        // Description: lines between title and first section header (or everything if no headers)
        var descEnd = new[] { ingredientStart, instructionStart }
            .Where(i => i > 0)
            .DefaultIfEmpty(lines.Count)
            .Min();

        var description = string.Join(" ", lines
            .Skip(1)
            .Take(descEnd - 1)
            .Where(l => l.Length > 0));

        // Ingredients
        var ingredients = new List<Ingredient>();
        if (ingredientStart >= 0)
        {
            var endIdx = instructionStart > ingredientStart ? instructionStart : lines.Count;
            ingredients = lines
                .Skip(ingredientStart + 1)
                .Take(endIdx - ingredientStart - 1)
                .Where(l => l.Length > 0)
                .Select(l => new Ingredient(l.TrimStart('-', '*', '•', ' '), null))
                .ToList();
        }

        // Instructions
        var instructions = new List<InstructionStep>();
        if (instructionStart >= 0)
        {
            var stepLines = lines
                .Skip(instructionStart + 1)
                .Where(l => l.Length > 0)
                .ToList();

            for (var i = 0; i < stepLines.Count; i++)
            {
                // Strip leading step numbers like "1." or "Step 1:"
                var text = System.Text.RegularExpressions.Regex.Replace(
                    stepLines[i], @"^(step\s*)?\d+[\.\:\)]\s*", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                instructions.Add(new InstructionStep($"Step {i + 1}", text.Length > 0 ? text : stepLines[i]));
            }
        }

        if (ingredients.Count == 0)
            ingredients.Add(new Ingredient("Add your ingredients here", null));

        if (instructions.Count == 0)
            instructions.Add(new InstructionStep("Instructions", "Add your instructions here"));

        return new Recipe
        {
            Title = title,
            Description = description.Length > 0 ? description : "",
            ImageUrl = "",
            SourceUrl = "",
            Category = "Dinner",
            Difficulty = Difficulty.Medium,
            PrepTime = "",
            Calories = "",
            Servings = "",
            Tags = ["Imported"],
            Ingredients = ingredients,
            Instructions = instructions,
        };
    }
}
