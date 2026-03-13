package hermescraft;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.minecraft.client.MinecraftClient;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.recipe.CraftingRecipe;
import net.minecraft.recipe.Ingredient;
import net.minecraft.recipe.Recipe;
import net.minecraft.recipe.RecipeEntry;
import net.minecraft.recipe.RecipeType;
import net.minecraft.recipe.ShapedRecipe;
import net.minecraft.recipe.ShapelessRecipe;
import net.minecraft.recipe.SmeltingRecipe;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

public class RecipeLookup {

    /**
     * Look up recipes for a given item name.
     * @param itemName the item identifier (e.g., "diamond_pickaxe" or "minecraft:diamond_pickaxe")
     * @return JSON string with recipe details
     */
    public static String lookup(String itemName) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null || client.world == null) {
            return "{\"error\":\"Not in game\"}";
        }

        CompletableFuture<String> future = new CompletableFuture<>();

        client.execute(() -> {
            try {
                future.complete(doLookup(client, itemName));
            } catch (Exception e) {
                HermesBridgeMod.LOGGER.error("[HermesBridge] Recipe lookup failed for: " + itemName, e);
                future.complete("{\"error\":\"" + e.getMessage() + "\"}");
            }
        });

        try {
            return future.get(3, TimeUnit.SECONDS);
        } catch (Exception e) {
            return "{\"error\":\"Recipe lookup timed out\"}";
        }
    }

    private static String doLookup(MinecraftClient client, String itemName) {
        // Resolve the item
        Identifier itemId;
        if (itemName.contains(":")) {
            itemId = Identifier.of(itemName);
        } else {
            itemId = Identifier.ofVanilla(itemName);
        }

        Item targetItem = Registries.ITEM.get(itemId);
        if (targetItem == Registries.ITEM.get(Identifier.ofVanilla("air"))) {
            JsonObject error = new JsonObject();
            error.addProperty("error", "Unknown item: " + itemName);
            return error.toString();
        }

        JsonObject result = new JsonObject();
        result.addProperty("item", itemId.toString());
        JsonArray recipes = new JsonArray();

        // Search all recipes in the recipe manager
        var recipeManager = client.world.getRecipeManager();

        for (RecipeEntry<?> entry : recipeManager.values()) {
            Recipe<?> recipe = entry.value();
            ItemStack output = recipe.getResult(client.world.getRegistryManager());

            if (output.getItem() == targetItem) {
                JsonObject recipeJson = new JsonObject();
                recipeJson.addProperty("id", entry.id().toString());

                if (recipe instanceof ShapedRecipe shaped) {
                    recipeJson.addProperty("type", "shaped");
                    recipeJson.addProperty("width", shaped.getWidth());
                    recipeJson.addProperty("height", shaped.getHeight());
                    recipeJson.add("ingredients", serializeIngredients(shaped.getIngredients()));
                } else if (recipe instanceof ShapelessRecipe shapeless) {
                    recipeJson.addProperty("type", "shapeless");
                    recipeJson.add("ingredients", serializeIngredients(shapeless.getIngredients()));
                } else if (recipe instanceof SmeltingRecipe smelting) {
                    recipeJson.addProperty("type", "smelting");
                    recipeJson.add("ingredients", serializeIngredients(smelting.getIngredients()));
                    recipeJson.addProperty("cookTime", smelting.getCookingTime());
                    recipeJson.addProperty("experience", smelting.getExperience());
                } else {
                    recipeJson.addProperty("type", recipe.getType().toString());
                    recipeJson.add("ingredients", serializeIngredients(recipe.getIngredients()));
                }

                recipeJson.addProperty("outputCount", output.getCount());
                recipes.add(recipeJson);
            }
        }

        result.add("recipes", recipes);
        result.addProperty("count", recipes.size());
        return result.toString();
    }

    private static JsonArray serializeIngredients(java.util.List<Ingredient> ingredients) {
        JsonArray arr = new JsonArray();
        for (Ingredient ingredient : ingredients) {
            if (ingredient.isEmpty()) {
                arr.add("empty");
                continue;
            }
            ItemStack[] stacks = ingredient.getMatchingStacks();
            if (stacks.length == 1) {
                arr.add(Registries.ITEM.getId(stacks[0].getItem()).toString());
            } else if (stacks.length > 1) {
                JsonArray alternatives = new JsonArray();
                for (ItemStack stack : stacks) {
                    alternatives.add(Registries.ITEM.getId(stack.getItem()).toString());
                }
                arr.add(alternatives);
            } else {
                arr.add("unknown");
            }
        }
        return arr;
    }
}
