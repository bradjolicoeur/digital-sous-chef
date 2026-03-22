using Marten;

namespace DigitalSousChef.Server.Features.Recipes;

public record CreateRecipeCommand(
    string Title,
    string Description,
    string ImageUrl,
    string SourceUrl,
    string PrepTime,
    int? PrepTimeMinutes,
    string Calories,
    int? CaloriesValue,
    string Servings,
    int? ServingsValue,
    Difficulty Difficulty,
    string Category,
    List<string> Tags,
    List<Ingredient> Ingredients,
    List<InstructionStep> Instructions,
    int? ProteinGrams,
    int? CarbGrams,
    int? FatGrams);

public class CreateRecipeHandler
{
    public static async Task<Recipe> Handle(
        CreateRecipeCommand cmd,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);
        var recipe = new Recipe
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ImportedAt = DateTimeOffset.UtcNow,
            Title = cmd.Title,
            Description = cmd.Description,
            ImageUrl = cmd.ImageUrl,
            SourceUrl = cmd.SourceUrl,
            PrepTime = cmd.PrepTime,
            PrepTimeMinutes = cmd.PrepTimeMinutes,
            Calories = cmd.Calories,
            CaloriesValue = cmd.CaloriesValue,
            Servings = cmd.Servings,
            ServingsValue = cmd.ServingsValue,
            Difficulty = cmd.Difficulty,
            Category = cmd.Category,
            Tags = cmd.Tags,
            Ingredients = cmd.Ingredients,
            Instructions = cmd.Instructions,
            ProteinGrams = cmd.ProteinGrams,
            CarbGrams = cmd.CarbGrams,
            FatGrams = cmd.FatGrams,
        };
        session.Store(recipe);
        await session.SaveChangesAsync();
        return recipe;
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
