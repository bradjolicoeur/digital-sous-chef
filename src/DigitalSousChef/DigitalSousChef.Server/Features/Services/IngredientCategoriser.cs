using DigitalSousChef.Server.Features.GroceryList;
using DigitalSousChef.Server.Features.Recipes;

namespace DigitalSousChef.Server.Features.Services;

public interface IIngredientCategoriser
{
    List<GroceryItem> Categorise(List<Ingredient> ingredients);
}

public class IngredientCategoriser : IIngredientCategoriser
{
    private static readonly Dictionary<string, string> CategoryKeywords = new(StringComparer.OrdinalIgnoreCase)
    {
        // Produce
        ["tomato"] = "Produce", ["lettuce"] = "Produce", ["onion"] = "Produce",
        ["garlic"] = "Produce", ["pepper"] = "Produce", ["carrot"] = "Produce",
        ["potato"] = "Produce", ["avocado"] = "Produce", ["lemon"] = "Produce",
        ["lime"] = "Produce", ["basil"] = "Produce", ["cilantro"] = "Produce",
        ["spinach"] = "Produce", ["kale"] = "Produce", ["mushroom"] = "Produce",
        ["cucumber"] = "Produce", ["broccoli"] = "Produce", ["zucchini"] = "Produce",
        ["ginger"] = "Produce", ["berry"] = "Produce", ["apple"] = "Produce",
        ["banana"] = "Produce", ["mango"] = "Produce", ["bok choy"] = "Produce",

        // Dairy & Chilled
        ["milk"] = "Dairy & Chilled", ["cheese"] = "Dairy & Chilled", ["butter"] = "Dairy & Chilled",
        ["cream"] = "Dairy & Chilled", ["yogurt"] = "Dairy & Chilled", ["egg"] = "Dairy & Chilled",
        ["mozzarella"] = "Dairy & Chilled", ["feta"] = "Dairy & Chilled", ["tofu"] = "Dairy & Chilled",

        // Meat
        ["chicken"] = "Meat", ["beef"] = "Meat", ["pork"] = "Meat",
        ["lamb"] = "Meat", ["turkey"] = "Meat", ["sausage"] = "Meat",
        ["bacon"] = "Meat",

        // Seafood
        ["salmon"] = "Seafood", ["shrimp"] = "Seafood", ["tuna"] = "Seafood",
        ["cod"] = "Seafood", ["fish"] = "Seafood", ["prawn"] = "Seafood",
        ["crab"] = "Seafood",

        // Pantry
        ["rice"] = "Pantry", ["pasta"] = "Pantry", ["flour"] = "Pantry",
        ["sugar"] = "Pantry", ["salt"] = "Pantry", ["oil"] = "Pantry",
        ["vinegar"] = "Pantry", ["sauce"] = "Pantry", ["soy"] = "Pantry",
        ["quinoa"] = "Pantry", ["oat"] = "Pantry", ["honey"] = "Pantry",
        ["miso"] = "Pantry", ["mirin"] = "Pantry", ["tahini"] = "Pantry",
        ["chickpea"] = "Pantry", ["bean"] = "Pantry", ["lentil"] = "Pantry",
        ["noodle"] = "Pantry", ["fettuccine"] = "Pantry", ["sesame"] = "Pantry",
        ["truffle"] = "Pantry", ["olive"] = "Pantry", ["oregano"] = "Pantry",
    };

    public List<GroceryItem> Categorise(List<Ingredient> ingredients)
    {
        var deduped = new Dictionary<string, GroceryItem>(StringComparer.OrdinalIgnoreCase);

        foreach (var ingredient in ingredients)
        {
            var normalised = ingredient.Item.Trim().ToLowerInvariant();
            if (deduped.ContainsKey(normalised))
            {
                deduped[normalised].Quantity++;
                continue;
            }

            var category = DetermineCategory(ingredient.Item);
            deduped[normalised] = new GroceryItem
            {
                Id = Guid.NewGuid(),
                Name = ingredient.Item,
                Note = ingredient.Note,
                Quantity = 1,
                Category = category,
                IsPurchased = false
            };
        }

        return deduped.Values.ToList();
    }

    private static string DetermineCategory(string itemName)
    {
        var lower = itemName.ToLowerInvariant();
        foreach (var (keyword, category) in CategoryKeywords)
        {
            if (lower.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                return category;
        }
        return "Other";
    }
}
