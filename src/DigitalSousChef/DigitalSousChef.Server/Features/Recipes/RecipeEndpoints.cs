using Microsoft.AspNetCore.Mvc;
using Wolverine;
using Wolverine.Http;

namespace DigitalSousChef.Server.Features.Recipes;

public static class RecipeEndpoints
{
    [WolverinePost("/api/recipes")]
    public static async Task<IResult> CreateRecipe(
        CreateRecipeCommand cmd,
        IMessageBus bus)
    {
        var recipe = await bus.InvokeAsync<Recipe>(cmd);
        return Results.Created($"/api/recipes/{recipe.Id}", recipe);
    }

    [WolverinePut("/api/recipes/{id}")]
    public static async Task<IResult> UpdateRecipe(
        Guid id,
        [FromBody] UpdateRecipeCommand cmd,
        IMessageBus bus)
    {
        var merged = cmd with { Id = id };
        var recipe = await bus.InvokeAsync<Recipe?>(merged);
        return recipe is null ? Results.NotFound() : Results.Ok(recipe);
    }

    [WolverinePost("/api/recipes/import")]
    public static async Task<IResult> ImportRecipe(
        ImportRecipeCommand cmd,
        IMessageBus bus)
    {
        var recipe = await bus.InvokeAsync<Recipe>(cmd);
        return Results.Created($"/api/recipes/{recipe.Id}", recipe);
    }

    [WolverineGet("/api/recipes")]
    public static async Task<IResult> GetRecipes(
        string? category,
        string? search,
        IMessageBus bus)
    {
        var result = await bus.InvokeAsync<List<RecipeSummary>>(new GetRecipesQuery(category, search));
        return Results.Ok(result);
    }

    [WolverineGet("/api/recipes/{id}")]
    public static async Task<IResult> GetRecipe(
        Guid id,
        IMessageBus bus)
    {
        var recipe = await bus.InvokeAsync<Recipe?>(new GetRecipeQuery(id));
        return recipe is null ? Results.NotFound() : Results.Ok(recipe);
    }

    [WolverinePatch("/api/recipes/{id}/favorite")]
    public static async Task<IResult> ToggleFavorite(
        Guid id,
        IMessageBus bus)
    {
        var recipe = await bus.InvokeAsync<Recipe?>(new ToggleFavoriteCommand(id));
        return recipe is null ? Results.NotFound() : Results.Ok(recipe);
    }

    [WolverineDelete("/api/recipes/{id}")]
    public static async Task<IResult> DeleteRecipe(
        Guid id,
        IMessageBus bus)
    {
        await bus.InvokeAsync(new DeleteRecipeCommand(id));
        return Results.NoContent();
    }
}
