using Wolverine;
using Wolverine.Http;

namespace DigitalSousChef.Server.Features.MealPlanner;

public static class PlannerEndpoints
{
    [WolverineGet("/api/mealplan/{weekStartDate}")]
    public static async Task<IResult> GetMealPlan(
        DateOnly weekStartDate,
        IMessageBus bus)
    {
        var plan = await bus.InvokeAsync<MealPlan>(new GetMealPlanQuery(weekStartDate));
        return Results.Ok(plan);
    }

    [WolverinePut("/api/mealplan/{weekStartDate}/slots")]
    public static async Task<IResult> AssignMealSlot(
        DateOnly weekStartDate,
        AssignMealSlotRequest request,
        IMessageBus bus)
    {
        var plan = await bus.InvokeAsync<MealPlan>(new AssignMealSlotCommand(
            weekStartDate, request.Date, request.MealType, request.RecipeId));
        return Results.Ok(plan);
    }

    [WolverineDelete("/api/mealplan/{weekStartDate}/slots")]
    public static async Task<IResult> RemoveMealSlot(
        DateOnly weekStartDate,
        DateOnly date,
        MealType mealType,
        Guid recipeId,
        IMessageBus bus)
    {
        var plan = await bus.InvokeAsync<MealPlan?>(new RemoveMealSlotCommand(weekStartDate, date, mealType, recipeId));
        return plan is null ? Results.NotFound() : Results.Ok(plan);
    }
}

public record AssignMealSlotRequest(DateOnly Date, MealType MealType, Guid RecipeId);
