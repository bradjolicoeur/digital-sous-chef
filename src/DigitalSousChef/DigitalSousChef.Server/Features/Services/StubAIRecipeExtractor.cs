using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using DigitalSousChef.Server.Features.Recipes;

namespace DigitalSousChef.Server.Features.Services;

public partial class StubAIRecipeExtractor : IAIRecipeExtractor
{
    private readonly HttpClient _httpClient;

    public StubAIRecipeExtractor(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    public async Task<Recipe> ExtractAsync(string url)
    {
        // Fetch the page HTML
        var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var html = await response.Content.ReadAsStringAsync();

        // Extract a basic title from <title> tag
        var titleMatch = TitleTagRegex().Match(html);
        var title = titleMatch.Success ? titleMatch.Groups[1].Value.Trim() : "Imported Recipe";

        // Strip HTML to get description text
        var plainText = HtmlTagRegex().Replace(html, " ");
        plainText = WhitespaceRegex().Replace(plainText, " ").Trim();
        var description = plainText.Length > 200 ? plainText[..200] + "..." : plainText;

        return new Recipe
        {
            SourceUrl = url,
            Title = System.Net.WebUtility.HtmlDecode(title),
            Description = System.Net.WebUtility.HtmlDecode(description),
            Category = "Dinner",
            Difficulty = Difficulty.Medium,
            PrepTime = "30 min",
            PrepTimeMinutes = 30,
            Calories = "400 kcal",
            CaloriesValue = 400,
            Servings = "2 Persons",
            ServingsValue = 2,
            Tags = ["Imported"],
            Ingredients =
            [
                new Ingredient("See original recipe for ingredients", null)
            ],
            Instructions =
            [
                new InstructionStep("Visit Source", $"See the original recipe at {url}")
            ]
        };
    }

    [GeneratedRegex(@"<title[^>]*>(.*?)</title>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex TitleTagRegex();

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex HtmlTagRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
