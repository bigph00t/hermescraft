package hermescraft;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.registry.RegistryKey;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.world.World;

import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

public class StateReader {

    private static volatile String cachedState = "{}";

    // Notable blocks to report when nearby
    private static final Set<String> NOTABLE_BLOCKS = Set.of(
            "minecraft:diamond_ore", "minecraft:deepslate_diamond_ore",
            "minecraft:iron_ore", "minecraft:deepslate_iron_ore",
            "minecraft:gold_ore", "minecraft:deepslate_gold_ore",
            "minecraft:coal_ore", "minecraft:deepslate_coal_ore",
            "minecraft:copper_ore", "minecraft:deepslate_copper_ore",
            "minecraft:lapis_ore", "minecraft:deepslate_lapis_ore",
            "minecraft:redstone_ore", "minecraft:deepslate_redstone_ore",
            "minecraft:emerald_ore", "minecraft:deepslate_emerald_ore",
            "minecraft:ancient_debris",
            "minecraft:chest", "minecraft:trapped_chest", "minecraft:ender_chest",
            "minecraft:barrel", "minecraft:shulker_box",
            "minecraft:crafting_table", "minecraft:furnace", "minecraft:blast_furnace",
            "minecraft:smoker", "minecraft:smithing_table", "minecraft:anvil",
            "minecraft:enchanting_table", "minecraft:brewing_stand",
            "minecraft:nether_portal", "minecraft:end_portal", "minecraft:end_portal_frame",
            "minecraft:spawner", "minecraft:trial_spawner",
            "minecraft:bed", "minecraft:respawn_anchor",
            "minecraft:beacon", "minecraft:conduit",
            // Tree logs — essential for finding trees
            "minecraft:oak_log", "minecraft:birch_log", "minecraft:spruce_log",
            "minecraft:jungle_log", "minecraft:acacia_log", "minecraft:dark_oak_log",
            "minecraft:cherry_log", "minecraft:mangrove_log",
            // Food sources
            "minecraft:sugar_cane", "minecraft:pumpkin", "minecraft:melon"
    );

    /**
     * Returns the current game state as a JSON string.
     * Thread-safe — reads the cached state updated on the client tick.
     */
    public static String getState() {
        return cachedState;
    }

    /**
     * Called from the client tick to update the cached state.
     * Runs on the render/client thread, so MC access is safe.
     */
    public static void updateCachedState() {
        try {
            MinecraftClient client = MinecraftClient.getInstance();
            if (client == null || client.player == null || client.world == null) {
                JsonObject obj = new JsonObject();
                obj.addProperty("error", "Not in game");
                cachedState = obj.toString();
                return;
            }
            cachedState = buildState(client).toString();
        } catch (Exception e) {
            HermesBridgeMod.LOGGER.error("[HermesBridge] Error updating cached state", e);
        }
    }

    /**
     * Force a fresh state read (blocks the calling thread until the client thread completes).
     * Used by the HTTP handler for on-demand state queries.
     */
    public static String getStateFresh() {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null || client.player == null) {
            return "{\"error\":\"Not in game\"}";
        }
        CompletableFuture<String> future = new CompletableFuture<>();
        client.execute(() -> {
            try {
                future.complete(buildState(client).toString());
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        try {
            return future.get(2, TimeUnit.SECONDS);
        } catch (Exception e) {
            return cachedState; // fallback to cached
        }
    }

    private static JsonObject buildState(MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        World world = client.world;
        JsonObject state = new JsonObject();

        // Player vitals
        state.addProperty("health", player.getHealth());
        state.addProperty("maxHealth", player.getMaxHealth());
        state.addProperty("food", player.getHungerManager().getFoodLevel());
        state.addProperty("saturation", player.getHungerManager().getSaturationLevel());
        state.addProperty("armor", player.getArmor());

        // Position
        JsonObject pos = new JsonObject();
        pos.addProperty("x", Math.round(player.getX() * 100.0) / 100.0);
        pos.addProperty("y", Math.round(player.getY() * 100.0) / 100.0);
        pos.addProperty("z", Math.round(player.getZ() * 100.0) / 100.0);
        state.add("position", pos);
        state.addProperty("yaw", Math.round(player.getYaw() * 10.0) / 10.0);
        state.addProperty("pitch", Math.round(player.getPitch() * 10.0) / 10.0);

        // Dimension
        RegistryKey<World> dimKey = world.getRegistryKey();
        String dimension = dimKey.getValue().getPath(); // "overworld", "the_nether", "the_end"
        state.addProperty("dimension", dimension);

        // Time
        long timeOfDay = world.getTimeOfDay() % 24000;
        state.addProperty("time", timeOfDay);
        state.addProperty("isDay", timeOfDay < 13000);

        // Biome
        try {
            Identifier biomeId = world.getBiome(player.getBlockPos()).getKey()
                    .map(k -> k.getValue()).orElse(Identifier.ofVanilla("unknown"));
            state.addProperty("biome", biomeId.toString());
        } catch (Exception e) {
            state.addProperty("biome", "unknown");
        }

        // Experience
        JsonObject xp = new JsonObject();
        xp.addProperty("level", player.experienceLevel);
        xp.addProperty("progress", Math.round(player.experienceProgress * 100.0) / 100.0);
        xp.addProperty("total", player.totalExperience);
        state.add("experience", xp);

        // Status flags
        state.addProperty("onFire", player.isOnFire());
        state.addProperty("inWater", player.isTouchingWater());
        state.addProperty("isSleeping", player.isSleeping());
        state.addProperty("isSneaking", player.isSneaking());
        state.addProperty("isSprinting", player.isSprinting());
        state.addProperty("onGround", player.isOnGround());

        // Current held item
        int selectedSlot = player.getInventory().selectedSlot;
        ItemStack heldStack = player.getInventory().getStack(selectedSlot);
        if (!heldStack.isEmpty()) {
            state.addProperty("currentItem", Registries.ITEM.getId(heldStack.getItem()).getPath());
        }

        // Inventory
        state.add("inventory", buildInventory(player.getInventory()));
        state.add("hotbar", buildHotbar(player.getInventory()));
        state.addProperty("selectedSlot", selectedSlot);

        // Armor slots
        state.add("armor_items", buildArmorSlots(player));

        // Offhand
        ItemStack offhand = player.getOffHandStack();
        if (!offhand.isEmpty()) {
            state.add("offhand", buildItemJson(offhand, -1));
        }

        // Nearby entities
        state.add("nearbyEntities", buildNearbyEntities(player, world));

        // Nearby notable blocks
        state.add("nearbyBlocks", buildNearbyBlocks(player, world));

        // Active effects
        state.add("effects", buildEffects(player));

        // Baritone status
        state.addProperty("isPathing", BaritoneIntegration.isPathing());

        return state;
    }

    private static JsonArray buildInventory(PlayerInventory inv) {
        JsonArray arr = new JsonArray();
        for (int i = 0; i < inv.size(); i++) {
            ItemStack stack = inv.getStack(i);
            if (!stack.isEmpty()) {
                arr.add(buildItemJson(stack, i));
            }
        }
        return arr;
    }

    private static JsonArray buildHotbar(PlayerInventory inv) {
        JsonArray arr = new JsonArray();
        for (int i = 0; i < 9; i++) {
            ItemStack stack = inv.getStack(i);
            JsonObject slot = new JsonObject();
            slot.addProperty("slot", i);
            if (!stack.isEmpty()) {
                slot.addProperty("item", Registries.ITEM.getId(stack.getItem()).toString());
                slot.addProperty("count", stack.getCount());
                addDurability(slot, stack);
            } else {
                slot.addProperty("item", "empty");
                slot.addProperty("count", 0);
            }
            arr.add(slot);
        }
        return arr;
    }

    private static JsonObject buildItemJson(ItemStack stack, int slot) {
        JsonObject obj = new JsonObject();
        if (slot >= 0) {
            obj.addProperty("slot", slot);
        }
        obj.addProperty("item", Registries.ITEM.getId(stack.getItem()).toString());
        obj.addProperty("count", stack.getCount());
        addDurability(obj, stack);
        return obj;
    }

    private static void addDurability(JsonObject obj, ItemStack stack) {
        if (stack.getMaxDamage() > 0) {
            obj.addProperty("durability", stack.getMaxDamage() - stack.getDamage());
            obj.addProperty("maxDurability", stack.getMaxDamage());
        }
    }

    private static JsonArray buildArmorSlots(ClientPlayerEntity player) {
        JsonArray arr = new JsonArray();
        // Armor inventory: boots=0, leggings=1, chestplate=2, helmet=3
        String[] slotNames = {"boots", "leggings", "chestplate", "helmet"};
        for (int i = 0; i < 4; i++) {
            ItemStack stack = player.getInventory().armor.get(i);
            if (!stack.isEmpty()) {
                JsonObject obj = buildItemJson(stack, -1);
                obj.addProperty("slotName", slotNames[i]);
                arr.add(obj);
            }
        }
        return arr;
    }

    private static JsonArray buildNearbyEntities(ClientPlayerEntity player, World world) {
        JsonArray arr = new JsonArray();
        double radius = 32.0;
        Box box = player.getBoundingBox().expand(radius);
        List<Entity> entities = world.getOtherEntities(player, box);

        int count = 0;
        for (Entity entity : entities) {
            if (count >= 50) break; // cap to avoid huge payloads

            JsonObject obj = new JsonObject();
            obj.addProperty("type", Registries.ENTITY_TYPE.getId(entity.getType()).toString());
            obj.addProperty("distance", Math.round(entity.distanceTo(player) * 10.0) / 10.0);

            JsonObject ePos = new JsonObject();
            ePos.addProperty("x", Math.round(entity.getX() * 10.0) / 10.0);
            ePos.addProperty("y", Math.round(entity.getY() * 10.0) / 10.0);
            ePos.addProperty("z", Math.round(entity.getZ() * 10.0) / 10.0);
            obj.add("position", ePos);

            if (entity instanceof LivingEntity living) {
                obj.addProperty("health", living.getHealth());
                obj.addProperty("maxHealth", living.getMaxHealth());
            }

            // Entity name if custom
            if (entity.hasCustomName()) {
                obj.addProperty("name", entity.getCustomName().getString());
            }

            arr.add(obj);
            count++;
        }
        return arr;
    }

    private static JsonArray buildNearbyBlocks(ClientPlayerEntity player, World world) {
        JsonArray arr = new JsonArray();
        BlockPos center = player.getBlockPos();
        int radius = 8;

        for (int dx = -radius; dx <= radius; dx++) {
            for (int dy = -radius; dy <= radius; dy++) {
                for (int dz = -radius; dz <= radius; dz++) {
                    BlockPos pos = center.add(dx, dy, dz);
                    BlockState blockState = world.getBlockState(pos);
                    Block block = blockState.getBlock();
                    String blockId = Registries.BLOCK.getId(block).toString();

                    if (NOTABLE_BLOCKS.contains(blockId)) {
                        JsonObject obj = new JsonObject();
                        obj.addProperty("block", blockId);
                        obj.addProperty("x", pos.getX());
                        obj.addProperty("y", pos.getY());
                        obj.addProperty("z", pos.getZ());
                        obj.addProperty("distance", Math.sqrt(dx * dx + dy * dy + dz * dz));
                        arr.add(obj);
                    }
                }
            }
        }
        return arr;
    }

    private static JsonArray buildEffects(ClientPlayerEntity player) {
        JsonArray arr = new JsonArray();
        for (StatusEffectInstance effect : player.getStatusEffects()) {
            JsonObject obj = new JsonObject();
            obj.addProperty("effect", effect.getEffectType().value().getTranslationKey());
            obj.addProperty("amplifier", effect.getAmplifier());
            obj.addProperty("duration", effect.getDuration());
            arr.add(obj);
        }
        return arr;
    }
}
