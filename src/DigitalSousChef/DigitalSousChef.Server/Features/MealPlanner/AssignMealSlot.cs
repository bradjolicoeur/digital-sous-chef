using DigitalSousChef.Server.Features.Recipes;
using Marten;

namespace DigitalSousChef.Server.Features.MealPlanner;

public record AssignMealSlotCommand(
    DateOnly WeekStartDate,
    DateOnly Date,
    MealType MealType,
    Guid RecipeId
);

public class AssignMealSlotHandler
{
    public static async Task<MealPlan> Handle(
        AssignMealSlotCommand cmd,
        IDocumentSession session,
        IHttpContextAccessor ctx)
    {
        var userId = GetUserId(ctx);

        var plan = await session.Query<MealPlan>()
            .FirstOrDefaultAsync(p => p.UserId == userId && p.WeekStartDate == cmd.WeekStartDate);

        if (plan is null)
        {
            plan = new MealPlan
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                WeekStartDate = cmd.WeekStartDate
            };
        }

        var recipe = await session.LoadAsync<Recipe>(cmd.RecipeId);
        if (recipe is null || recipe.UserId != userId)
            throw new InvalidOperationException("Recipe not found");

        // Remove existing slot for this date/meal type
        plan.Slots.RemoveAll(s => s.Date == cmd.Date && s.MealType == cmd.MealType);

        plan.Slots.Add(new MealSlot(
            cmd.Date,
            cmd.MealType,
            recipe.Id,
            recipe.Title,
            recipe.ImageUrl
        ));

        session.Store(plan);
        await session.SaveChangesAsync();
        return plan;
    }

    private static string GetUserId(IHttpContextAccessor ctx) =>
        ctx.HttpContext!.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? ctx.HttpContext!.User.FindFirst("sub")?.Value
        ?? throw new UnauthorizedAccessException();
}
