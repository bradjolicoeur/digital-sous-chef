using DigitalSousChef.Server.Features.Recipes;

namespace DigitalSousChef.Server.Features.Services;

public interface IAIRecipeExtractor
{
    Task<Recipe> ExtractAsync(string url);
    Task<Recipe> ExtractFromTextAsync(string rawText);
}
