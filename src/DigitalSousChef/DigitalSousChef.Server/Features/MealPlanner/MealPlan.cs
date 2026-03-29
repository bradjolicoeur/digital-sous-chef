namespace DigitalSousChef.Server.Features.MealPlanner;

public class MealPlan
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public DateOnly WeekStartDate { get; set; }
    public List<MealSlot> Slots { get; set; } = [];
}

public class MealSlot
{
    public DateOnly Date { get; set; }
    public MealType MealType { get; set; }
    public List<MealSlotRecipe> Recipes { get; set; } = [];
}

public record MealSlotRecipe(Guid RecipeId, string RecipeTitle, string RecipeImageUrl);

public enum MealType { Breakfast, Lunch, Dinner }
