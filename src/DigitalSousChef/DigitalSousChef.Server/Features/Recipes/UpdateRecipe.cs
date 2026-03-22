using Marten;

namespace DigitalSousChef.Server.Features.Recipes;

public record UpdateRecipeCommand(
    Guid Id,
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

public class UpdateRecipeHandler
{
    public static async Task<Recipe?> Handle(
        UpdateRecipeCommand cmd,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);
        var recipe = await session.LoadAsync<Recipe>(cmd.Id);
        if (recipe is null || recipe.UserId != userId)
            return null;

        recipe.Title = cmd.Title;
        recipe.Description = cmd.Description;
        recipe.ImageUrl = cmd.ImageUrl;
        recipe.SourceUrl = cmd.SourceUrl;
        recipe.PrepTime = cmd.PrepTime;
        recipe.PrepTimeMinutes = cmd.PrepTimeMinutes;
        recipe.Calories = cmd.Calories;
        recipe.CaloriesValue = cmd.CaloriesValue;
        recipe.Servings = cmd.Servings;
        recipe.ServingsValue = cmd.ServingsValue;
        recipe.Difficulty = cmd.Difficulty;
        recipe.Category = cmd.Category;
        recipe.Tags = cmd.Tags;
        recipe.Ingredients = cmd.Ingredients;
        recipe.Instructions = cmd.Instructions;
        recipe.ProteinGrams = cmd.ProteinGrams;
        recipe.CarbGrams = cmd.CarbGrams;
        recipe.FatGrams = cmd.FatGrams;

        session.Store(recipe);
        await session.SaveChangesAsync();
        return recipe;
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
