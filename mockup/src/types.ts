export interface Recipe {
  id: string;
  title: string;
  description: string;
  image: string;
  prepTime: string;
  calories: string;
  servings: string;
  difficulty: 'Easy' | 'Medium' | 'Intermediate' | 'Expert';
  category: string;
  tags: string[];
  ingredients: { item: string; note?: string }[];
  instructions: { title: string; text: string }[];
}

export const MOCK_RECIPES: Recipe[] = [
  {
    id: '1',
    title: 'Summer Harvest Buddha Bowl',
    description: 'A nutrient-dense bowl with roasted chickpeas, kale, and lemon-tahini dressing.',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800',
    prepTime: '20 min',
    calories: '380 kcal',
    servings: '1 Person',
    difficulty: 'Easy',
    category: 'Lunch',
    tags: ['Healthy', 'Vegan'],
    ingredients: [
      { item: '1 cup Quinoa, cooked' },
      { item: '1/2 cup Chickpeas, roasted' },
      { item: '1 cup Kale, chopped' },
      { item: '1/2 Avocado, sliced' },
      { item: '2 tbsp Tahini dressing' }
    ],
    instructions: [
      { title: 'Prepare the base', text: 'Place cooked quinoa in a large bowl.' },
      { title: 'Add vegetables', text: 'Arrange kale, chickpeas, and avocado on top.' },
      { title: 'Dress and serve', text: 'Drizzle with tahini dressing and enjoy.' }
    ]
  },
  {
    id: '2',
    title: 'Classic Greek Salad',
    description: 'The authentic recipe from Santorini using sun-ripened tomatoes and creamy feta.',
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=800',
    prepTime: '15 min',
    calories: '250 kcal',
    servings: '2 Persons',
    difficulty: 'Easy',
    category: 'Side',
    tags: ['Vegetarian'],
    ingredients: [
      { item: '2 large Tomatoes, chopped' },
      { item: '1 Cucumber, sliced' },
      { item: '1/2 Red onion, thinly sliced' },
      { item: '100g Feta cheese, cubed' },
      { item: '1/4 cup Kalamata olives' }
    ],
    instructions: [
      { title: 'Combine vegetables', text: 'In a large bowl, mix tomatoes, cucumber, and onion.' },
      { title: 'Add cheese and olives', text: 'Gently fold in feta and olives.' },
      { title: 'Season', text: 'Drizzle with olive oil and sprinkle with dried oregano.' }
    ]
  },
  {
    id: '3',
    title: 'Wild Mushroom Fettuccine',
    description: 'Hand-cut pasta tossed with forest mushrooms and white truffle oil.',
    image: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&q=80&w=800',
    prepTime: '40 min',
    calories: '520 kcal',
    servings: '2 Persons',
    difficulty: 'Intermediate',
    category: 'Main',
    tags: ['Vegetarian'],
    ingredients: [
      { item: '250g Fettuccine pasta' },
      { item: '200g Mixed wild mushrooms' },
      { item: '2 cloves Garlic, minced' },
      { item: '1/4 cup Heavy cream' },
      { item: '1 tsp White truffle oil' }
    ],
    instructions: [
      { title: 'Cook pasta', text: 'Boil pasta in salted water until al dente.' },
      { title: 'Sauté mushrooms', text: 'Cook mushrooms and garlic in butter until golden.' },
      { title: 'Make sauce', text: 'Stir in cream and simmer. Toss with pasta and truffle oil.' }
    ]
  },
  {
    id: '4',
    title: 'Miso-Glazed Wild Salmon',
    description: 'A delicate balance of umami and sweetness, marinated for six hours in white miso and mirin.',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&q=80&w=800',
    prepTime: '25 min',
    calories: '420 kcal',
    servings: '2 Persons',
    difficulty: 'Medium',
    category: 'Dinner',
    tags: ['Pescatarian', 'Healthy'],
    ingredients: [
      { item: '2 Wild-caught salmon fillets', note: 'Room temp' },
      { item: '3 tbsp White miso paste' },
      { item: '1 tbsp Mirin or honey' },
      { item: '2 bunches Baby bok choy', note: 'Halved' },
      { item: '1 tsp Toasted sesame oil' }
    ],
    instructions: [
      { title: 'Marinate the Salmon', text: 'Whisk together miso, mirin, and soy sauce. Coat salmon and let sit for 20 mins.' },
      { title: 'Char the Greens', text: 'Heat sesame oil. Char bok choy cut-side down for 3-4 minutes.' },
      { title: 'The Perfect Sear', text: 'Cook salmon skin-side down for 4 mins, then flip and glaze.' }
    ]
  }
];
