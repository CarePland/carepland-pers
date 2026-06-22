import {
  createGeneratedSupportRecipe,
  findSupportRecipe,
} from "./support-recipes.js";

const GENERATED_RECIPES_KEY = "carepland.receiver.generatedSupportRecipes";
const HELP_STATE_KEY = "carepland.receiver.supportHelpState";

export function getSupportRecipe(issue, context) {
  // TODO: replace local recipe lookup with GET /api/connect/support-recipes?issue=&context=.
  const generatedRecipes = loadGeneratedSupportRecipes();
  return findSupportRecipe(context, issue, generatedRecipes);
}

export function saveGeneratedSupportRecipe(issue, context, help) {
  // TODO: replace local save with POST /api/connect/support-recipes for Admin review.
  const generatedRecipes = loadGeneratedSupportRecipes();
  const recipe = createGeneratedSupportRecipe(context, issue, help);
  const withoutDuplicate = generatedRecipes.filter((item) => item.key !== recipe.key);
  writeJson(GENERATED_RECIPES_KEY, [recipe, ...withoutDuplicate]);
  return recipe;
}

export function loadSupportHelpState() {
  return readJson(HELP_STATE_KEY, { status: "not_started" });
}

export function saveSupportHelpState(nextState) {
  const current = loadSupportHelpState();
  const updated = {
    ...current,
    ...nextState,
    updatedAt: new Date().toISOString(),
  };
  writeJson(HELP_STATE_KEY, updated);
  return updated;
}

function loadGeneratedSupportRecipes() {
  return readJson(GENERATED_RECIPES_KEY, []);
}

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in embedded or private browser modes.
  }
}
