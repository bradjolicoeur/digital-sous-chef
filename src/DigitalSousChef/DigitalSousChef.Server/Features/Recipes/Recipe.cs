namespace DigitalSousChef.Server.Features.Recipes;

public class Recipe
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string ImageUrl { get; set; } = "";
    public string SourceUrl { get; set; } = "";
    public string PrepTime { get; set; } = "";
    public int? PrepTimeMinutes { get; set; }
    public string Calories { get; set; } = "";
    public int? CaloriesValue { get; set; }
    public string Servings { get; set; } = "";
    public int? ServingsValue { get; set; }
    public Difficulty Difficulty { get; set; }
    public string Category { get; set; } = "";
    public List<string> Tags { get; set; } = [];
    public List<Ingredient> Ingredients { get; set; } = [];
    public List<InstructionStep> Instructions { get; set; } = [];
    public bool IsFavorite { get; set; }
    public DateTimeOffset ImportedAt { get; set; }
    public int? ProteinGrams { get; set; }
    public int? CarbGrams { get; set; }
    public int? FatGrams { get; set; }
}

public record Ingredient(string Item, string? Note);

public record InstructionStep(string Title, string Text);

public enum Difficulty { Easy, Medium, Intermediate, Expert }

public record RecipeSummary(
    Guid Id,
    string Title,
    string Description,
    string ImageUrl,
    string PrepTime,
    string Calories,
    string Servings,
    Difficulty Difficulty,
    string Category,
    List<string> Tags,
    bool IsFavorite,
    DateTimeOffset ImportedAt
);
