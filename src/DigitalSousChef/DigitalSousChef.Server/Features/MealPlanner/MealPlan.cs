namespace DigitalSousChef.Server.Features.MealPlanner;

public class MealPlan
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public DateOnly WeekStartDate { get; set; }
    public List<MealSlot> Slots { get; set; } = [];
}

public record MealSlot(
    DateOnly Date,
    MealType MealType,
    Guid RecipeId,
    string RecipeTitle,
    string RecipeImageUrl
);

public enum MealType { Breakfast, Lunch, Dinner }
