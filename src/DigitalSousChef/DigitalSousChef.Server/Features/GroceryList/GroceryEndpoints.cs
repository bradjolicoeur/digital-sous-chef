using Wolverine;
using Wolverine.Http;

namespace DigitalSousChef.Server.Features.GroceryList;

public static class GroceryEndpoints
{
    [WolverineGet("/api/grocery")]
    public static async Task<IResult> GetGroceryList(IMessageBus bus)
    {
        var list = await bus.InvokeAsync<GroceryList?>(new GetGroceryListQuery());
        return list is null ? Results.Ok(new { items = Array.Empty<GroceryItem>() }) : Results.Ok(list);
    }

    [WolverinePost("/api/grocery/generate")]
    public static async Task<IResult> GenerateGroceryList(
        GenerateGroceryListCommand cmd,
        IMessageBus bus)
    {
        var list = await bus.InvokeAsync<GroceryList>(cmd);
        return Results.Ok(list);
    }

    [WolverinePost("/api/grocery/items")]
    public static async Task<IResult> AddGroceryItem(
        AddGroceryItemCommand cmd,
        IMessageBus bus)
    {
        var list = await bus.InvokeAsync<GroceryList>(cmd);
        return Results.Ok(list);
    }

    [WolverinePost("/api/grocery/items/bulk")]
    public static async Task<IResult> AddGroceryItemsBulk(
        AddGroceryItemsBulkCommand cmd,
        IMessageBus bus)
    {
        var list = await bus.InvokeAsync<GroceryList>(cmd);
        return Results.Ok(list);
    }

    [WolverinePatch("/api/grocery/items/{itemId}")]
    public static async Task<IResult> UpdateGroceryItem(
        Guid itemId,
        UpdateGroceryItemRequest request,
        IMessageBus bus)
    {
        var list = await bus.InvokeAsync<GroceryList?>(
            new UpdateGroceryItemCommand(itemId, request.IsPurchased, request.Quantity, request.Store));
        return list is null ? Results.NotFound() : Results.Ok(list);
    }

    [WolverineDelete("/api/grocery/items/{itemId}")]
    public static async Task<IResult> RemoveGroceryItem(
        Guid itemId,
        IMessageBus bus)
    {
        var list = await bus.InvokeAsync<GroceryList?>(new RemoveGroceryItemCommand(itemId));
        return list is null ? Results.NotFound() : Results.Ok(list);
    }

    [WolverineDelete("/api/grocery/items")]
    public static async Task<IResult> ClearPurchasedItems(
        bool purchased,
        string? store,
        IMessageBus bus)
    {
        if (!purchased) return Results.BadRequest();
        var list = await bus.InvokeAsync<GroceryList?>(new ClearPurchasedItemsCommand(store));
        return list is null ? Results.NotFound() : Results.Ok(list);
    }
}

public record UpdateGroceryItemRequest(bool? IsPurchased, int? Quantity, string? Store);
