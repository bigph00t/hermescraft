package hermescraft;

import com.google.gson.JsonObject;
import net.minecraft.block.BlockState;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.network.ClientPlayerInteractionManager;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.recipe.CraftingRecipe;
import net.minecraft.recipe.Ingredient;
import net.minecraft.recipe.Recipe;
import net.minecraft.recipe.RecipeEntry;
import net.minecraft.recipe.ShapedRecipe;
import net.minecraft.registry.Registries;
import net.minecraft.screen.AbstractFurnaceScreenHandler;
import net.minecraft.screen.CraftingScreenHandler;
import net.minecraft.screen.ScreenHandler;
import net.minecraft.screen.slot.SlotActionType;
import net.minecraft.util.Hand;
import net.minecraft.util.Identifier;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Direction;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

public class ActionExecutor {

    // --- Pending action from HTTP thread ---
    private static class PendingAction {
        final JsonObject action;
        final CompletableFuture<String> future;
        PendingAction(JsonObject action, CompletableFuture<String> future) {
            this.action = action;
            this.future = future;
        }
    }

    private static final AtomicReference<PendingAction> pendingAction = new AtomicReference<>(null);

    // --- Sustained (multi-tick) action state ---
    private static volatile SustainedAction currentSustained = null;

    private static class SustainedAction {
        final String type;
        final CompletableFuture<String> future;
        int ticksRemaining;
        int ticksElapsed = 0;
        // break_block state
        BlockPos breakPos;
        Direction breakDir;
        String blockName;
        // eat state
        boolean eatStarted = false;
        int foodSlot = -1;
        String foodName;
        // craft state
        CraftingRecipe craftRecipe;
        int craftGridWidth;
        int craftInvStart;
        int craftInvEnd;
        int craftStep = 0;
        String craftItemName;
        java.util.List<int[]> craftMoves; // [ingredientIdx, gridSlot]
        // smelt state
        int smeltStep = 0;
        String smeltItemName;
        String smeltCollected;
        // look_at_block (approach) state
        BlockPos approachTarget;
        String approachBlockName;
        // pickup_items state
        int pickupPhase = 0; // 0=forward, 1=left, 2=back, 3=right
        // fish state
        boolean fishCast = false;
        int fishWaitTicks = 0;

        SustainedAction(String type, CompletableFuture<String> future, int maxTicks) {
            this.type = type;
            this.future = future;
            this.ticksRemaining = maxTicks;
        }
    }

    /**
     * Called from HTTP thread. Queues the action for tick-thread processing.
     */
    public static String execute(JsonObject action) {
        if (!action.has("type")) {
            return errorResult("Missing 'type' field in action");
        }

        String type = action.get("type").getAsString();
        MinecraftClient client = MinecraftClient.getInstance();

        if (client == null || client.player == null) {
            return errorResult("Not in game");
        }

        // Reject if a sustained action is running (except "stop" which can cancel it)
        if (currentSustained != null && !"stop".equals(type)) {
            return errorResult("Busy with sustained action: " + currentSustained.type);
        }

        CompletableFuture<String> future = new CompletableFuture<>();
        PendingAction pa = new PendingAction(action, future);

        // Try to set pending action — fail if one already queued
        if (!pendingAction.compareAndSet(null, pa)) {
            return errorResult("Another action is already pending");
        }

        try {
            return future.get(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            pendingAction.compareAndSet(pa, null); // clean up
            return errorResult("Action timed out or failed: " + e.getMessage());
        }
    }

    /**
     * Called EVERY tick from the client tick event.
     * Processes pending instant actions and sustains multi-tick actions.
     */
    public static void processTick(MinecraftClient client) {
        // Clear stale sustained action if player disconnected
        if (client.player == null) {
            SustainedAction stale = currentSustained;
            if (stale != null) {
                currentSustained = null;
                if (!stale.future.isDone()) {
                    stale.future.complete(errorResult("Player disconnected during " + stale.type));
                }
            }
            return;
        }

        // 1. Check for pending "stop" action that should interrupt sustained actions
        if (currentSustained != null) {
            PendingAction stopCheck = pendingAction.get();
            if (stopCheck != null && "stop".equals(stopCheck.action.get("type").getAsString())) {
                // Consume the stop action and cancel sustained
                pendingAction.compareAndSet(stopCheck, null);
                String result = handleStop(client);
                stopCheck.future.complete(result);
                return;
            }
        }

        // 2. Process sustained action if one is running
        if (currentSustained != null) {
            try {
                tickSustainedAction(client);
            } catch (Exception e) {
                HermesBridgeMod.LOGGER.error("[HermesBridge] Exception in sustained action", e);
                releaseAllKeys(client);
                completeSustained(errorResult("Sustained action crashed: " + e.getMessage()));
            }
            return; // Don't start new actions while sustained is running
        }

        // 3. Check for pending action
        PendingAction pa = pendingAction.getAndSet(null);
        if (pa == null) return;

        try {
            String type = pa.action.get("type").getAsString();

            // Check if this is a sustained action type
            switch (type) {
                case "break_block" -> {
                    startBreakBlock(client, pa.future);
                    return;
                }
                case "walk" -> {
                    int ticks = pa.action.has("ticks") ? pa.action.get("ticks").getAsInt() : 20;
                    startWalk(client, pa.future, ticks);
                    return;
                }
                case "eat" -> {
                    startEat(client, pa.future);
                    return;
                }
                case "craft" -> {
                    startCraft(client, pa.action, pa.future);
                    return;
                }
                case "smelt" -> {
                    startSmelt(client, pa.action, pa.future);
                    return;
                }
                case "look_at_block" -> {
                    startApproachBlock(client, pa.action, pa.future);
                    return;
                }
                case "pickup_items" -> {
                    startPickupItems(client, pa.future);
                    return;
                }
                case "fish" -> {
                    startFish(client, pa.future);
                    return;
                }
            }

            // Instant action — execute immediately on the client thread
            String result = executeInstant(type, pa.action, client);
            pa.future.complete(result);
        } catch (Exception e) {
            HermesBridgeMod.LOGGER.error("[HermesBridge] Error executing action", e);
            pa.future.complete(errorResult("Exception: " + e.getMessage()));
        }
    }

    private static String executeInstant(String type, JsonObject action, MinecraftClient client) {
        return switch (type) {
            case "navigate" -> handleNavigate(action, client);
            case "mine" -> handleMine(action, client);
            case "interact_block" -> handleInteractBlock(action, client);
            case "attack" -> handleAttack(action, client);
            case "place" -> handlePlace(action, client);
            case "equip" -> handleEquip(action, client);
            case "look" -> handleLook(action, client);
            case "chat" -> handleChat(action, client);
            case "use_item" -> handleUseItem(client);
            case "drop" -> handleDrop(action, client);
            case "swap_hands" -> handleSwapHands(client);
            case "stop" -> handleStop(client);
            case "jump" -> handleJump(client);
            case "sneak" -> handleSneak(action, client);
            case "sprint" -> handleSprint(action, client);
            case "wait" -> handleWait();
            case "close_screen" -> handleCloseScreen(client);
            case "interact_entity" -> handleInteractEntity(action, client);
            default -> errorResult("Unknown action type: " + type);
        };
    }

    // ===================== SUSTAINED ACTIONS =====================

    private static void startBreakBlock(MinecraftClient client, CompletableFuture<String> future) {
        ClientPlayerEntity player = client.player;
        if (player == null || client.interactionManager == null) {
            future.complete(errorResult("Player not available"));
            return;
        }

        HitResult hit = client.crosshairTarget;
        if (hit == null || hit.getType() != HitResult.Type.BLOCK) {
            future.complete(errorResult("Not looking at a block"));
            return;
        }

        BlockHitResult blockHit = (BlockHitResult) hit;
        BlockPos pos = blockHit.getBlockPos();
        Direction dir = blockHit.getSide();

        BlockState blockState = client.world.getBlockState(pos);
        if (blockState.isAir()) {
            future.complete(errorResult("Looking at air"));
            return;
        }

        String blockName = Registries.BLOCK.getId(blockState.getBlock()).getPath();

        // Start breaking
        client.interactionManager.attackBlock(pos, dir);
        player.swingHand(Hand.MAIN_HAND);

        // Check if block broke instantly (creative mode or instant-break blocks)
        if (client.world.getBlockState(pos).isAir()) {
            future.complete(successResult("Broke " + blockName + " instantly"));
            return;
        }

        // Set up sustained breaking
        SustainedAction sa = new SustainedAction("break_block", future, 200);
        sa.breakPos = pos;
        sa.breakDir = dir;
        sa.blockName = blockName;
        currentSustained = sa;

        HermesBridgeMod.LOGGER.info("[HermesBridge] Started breaking {} at {}", blockName, pos);
    }

    private static void startWalk(MinecraftClient client, CompletableFuture<String> future, int ticks) {
        ClientPlayerEntity player = client.player;
        if (player == null) {
            future.complete(errorResult("Player not available"));
            return;
        }

        if (ticks < 1) ticks = 1;
        if (ticks > 200) ticks = 200;

        SustainedAction sa = new SustainedAction("walk", future, ticks);
        currentSustained = sa;

        // Start walking immediately this tick
        client.options.forwardKey.setPressed(true);

        HermesBridgeMod.LOGGER.info("[HermesBridge] Walking forward for {} ticks", ticks);
    }

    private static void startEat(MinecraftClient client, CompletableFuture<String> future) {
        ClientPlayerEntity player = client.player;
        if (player == null || client.interactionManager == null) {
            future.complete(errorResult("Player not available"));
            return;
        }

        // Find food in hotbar
        int foodSlot = -1;
        String foodName = null;
        for (int i = 0; i < 9; i++) {
            ItemStack stack = player.getInventory().getStack(i);
            if (!stack.isEmpty() && stack.getComponents().contains(DataComponentTypes.FOOD)) {
                foodSlot = i;
                foodName = Registries.ITEM.getId(stack.getItem()).getPath();
                break;
            }
        }

        if (foodSlot == -1) {
            future.complete(errorResult("No food found in hotbar"));
            return;
        }

        // Select food and start using
        player.getInventory().selectedSlot = foodSlot;
        client.interactionManager.interactItem(player, Hand.MAIN_HAND);

        SustainedAction sa = new SustainedAction("eat", future, 40); // 32 ticks eat + 8 buffer
        sa.foodSlot = foodSlot;
        sa.foodName = foodName;
        sa.eatStarted = true;
        currentSustained = sa;

        // Keep use key pressed to sustain eating
        client.options.useKey.setPressed(true);

        HermesBridgeMod.LOGGER.info("[HermesBridge] Eating {} from slot {}", foodName, foodSlot);
    }

    private static void tickSustainedAction(MinecraftClient client) {
        SustainedAction sa = currentSustained;
        if (sa == null) return;

        sa.ticksElapsed++;
        sa.ticksRemaining--;

        switch (sa.type) {
            case "break_block" -> tickBreakBlock(client, sa);
            case "walk" -> tickWalk(client, sa);
            case "eat" -> tickEat(client, sa);
            case "craft" -> tickCraft(client, sa);
            case "smelt" -> tickSmelt(client, sa);
            case "look_at_block" -> tickApproachBlock(client, sa);
            case "pickup_items" -> tickPickupItems(client, sa);
            case "fish" -> tickFish(client, sa);
        }
    }

    private static void tickBreakBlock(MinecraftClient client, SustainedAction sa) {
        // Check if block is now air (broken)
        if (client.world.getBlockState(sa.breakPos).isAir()) {
            completeSustained(successResult("Broke " + sa.blockName + " after " + sa.ticksElapsed + " ticks"));
            return;
        }

        // Timeout
        if (sa.ticksRemaining <= 0) {
            client.interactionManager.cancelBlockBreaking();
            completeSustained(errorResult("Block breaking timed out after " + sa.ticksElapsed + " ticks — need better tools?"));
            return;
        }

        // Continue breaking
        client.interactionManager.updateBlockBreakingProgress(sa.breakPos, sa.breakDir);
        client.player.swingHand(Hand.MAIN_HAND);
    }

    private static void tickWalk(MinecraftClient client, SustainedAction sa) {
        if (sa.ticksRemaining <= 0) {
            // Stop walking
            client.options.forwardKey.setPressed(false);
            completeSustained(successResult("Walked forward for " + sa.ticksElapsed + " ticks"));
            return;
        }

        // Keep forward key pressed
        client.options.forwardKey.setPressed(true);
    }

    private static void tickEat(MinecraftClient client, SustainedAction sa) {
        ClientPlayerEntity player = client.player;

        // Keep use key pressed to sustain eating
        client.options.useKey.setPressed(true);

        // Check if eating finished (player stopped using item naturally = eating complete)
        if (sa.ticksElapsed > 5 && !player.isUsingItem()) {
            client.options.useKey.setPressed(false);
            completeSustained(successResult("Ate " + sa.foodName));
            return;
        }

        // Timeout
        if (sa.ticksRemaining <= 0) {
            client.options.useKey.setPressed(false);
            if (player.isUsingItem()) {
                completeSustained(successResult("Eating " + sa.foodName + " (may still be in progress)"));
            } else {
                completeSustained(successResult("Ate " + sa.foodName));
            }
        }
    }

    private static void completeSustained(String result) {
        SustainedAction sa = currentSustained;
        currentSustained = null;
        if (sa != null && !sa.future.isDone()) {
            sa.future.complete(result);
        }
    }

    // ===================== FISHING =====================

    private static void startFish(MinecraftClient client, CompletableFuture<String> future) {
        ClientPlayerEntity player = client.player;
        if (player == null || client.interactionManager == null) {
            future.complete(errorResult("Player not available"));
            return;
        }

        // Find fishing rod in inventory and equip it
        boolean hasRod = selectHotbarItem(player, "fishing_rod");
        if (!hasRod) {
            future.complete(errorResult("No fishing_rod in inventory. Craft one first (3 sticks + 2 string)."));
            return;
        }

        // Cast the line — right-click with rod
        client.interactionManager.interactItem(player, Hand.MAIN_HAND);
        player.swingHand(Hand.MAIN_HAND);

        // Set up sustained fishing — wait for bobber catch, max 30 seconds (600 ticks)
        SustainedAction sa = new SustainedAction("fish", future, 600);
        sa.fishCast = true;
        sa.fishWaitTicks = 0;
        currentSustained = sa;

        HermesBridgeMod.LOGGER.info("[HermesBridge] Started fishing");
    }

    private static void tickFish(MinecraftClient client, SustainedAction sa) {
        ClientPlayerEntity player = client.player;
        if (player == null) {
            completeSustained(errorResult("Player disconnected while fishing"));
            return;
        }

        sa.fishWaitTicks++;

        // Check if the fishing bobber caught something
        net.minecraft.entity.projectile.FishingBobberEntity bobber = player.fishHook;

        if (bobber == null) {
            // Bobber gone — either not cast or already reeled in
            if (sa.fishWaitTicks > 10) {
                completeSustained(errorResult("Fishing line lost. Cast again."));
                return;
            }
            // Just cast — give it a moment
            return;
        }

        // Detect bite: after bobber has landed in water, check for dip
        if (sa.fishWaitTicks > 20) {
            boolean fishBiting = false;

            // Check bobber vertical velocity — negative Y means dipping
            double vy = bobber.getVelocity().y;
            if (vy < -0.04) {
                fishBiting = true;
            }

            // Also check if bobber is underwater and pulling
            if (bobber.isTouchingWater() && vy < -0.01) {
                fishBiting = true;
            }

            if (fishBiting) {
                // Reel in! Right-click again to catch the fish
                client.interactionManager.interactItem(player, Hand.MAIN_HAND);
                player.swingHand(Hand.MAIN_HAND);
                completeSustained(successResult("Caught a fish! (waited " + sa.fishWaitTicks + " ticks)"));
                return;
            }
        }

        // Timeout
        if (sa.ticksRemaining <= 0) {
            // Reel in without catch
            client.interactionManager.interactItem(player, Hand.MAIN_HAND);
            completeSustained(errorResult("Fishing timed out after 30 seconds. No bite. Try a different spot or try again."));
        }
    }

    private static void releaseAllKeys(MinecraftClient client) {
        try {
            client.options.forwardKey.setPressed(false);
            client.options.useKey.setPressed(false);
        } catch (Exception ignored) {}
    }

    // ===================== INSTANT ACTIONS =====================

    // --- Navigate using Baritone ---
    private static String handleNavigate(JsonObject action, MinecraftClient client) {
        if (!action.has("x") || !action.has("y") || !action.has("z")) {
            return errorResult("Navigate requires x, y, z coordinates");
        }
        ClientPlayerEntity player = client.player;
        if (player == null) return errorResult("Not in game");

        int x = action.get("x").getAsInt();
        int y = action.get("y").getAsInt();
        int z = action.get("z").getAsInt();

        // Check if already at/near destination
        double dist = Math.sqrt(player.getBlockPos().getSquaredDistance(new BlockPos(x, y, z)));
        if (dist < 3) {
            return successResult("Already at destination (" + Math.round(dist) + " blocks away)");
        }

        boolean started = BaritoneIntegration.navigate(x, y, z);
        if (started) {
            return successResult("Navigating to " + x + ", " + y + ", " + z + " (dist: " + Math.round(dist) + ")");
        } else {
            return errorResult("Failed to start navigation (Baritone not available)");
        }
    }

    // --- Mine blocks using Baritone (auto-stops after 10 seconds) ---
    private static String handleMine(JsonObject action, MinecraftClient client) {
        if (!action.has("blockName")) {
            return errorResult("Mine requires 'blockName'");
        }
        String blockName = action.get("blockName").getAsString();

        boolean started = BaritoneIntegration.mine(blockName, 1);
        if (!started) {
            return errorResult("Failed to start mining (Baritone not available)");
        }

        // Auto-stop Baritone after 10 seconds so agent can think again
        new Thread(() -> {
            try { Thread.sleep(10000); } catch (InterruptedException ignored) {}
            client.execute(() -> {
                BaritoneIntegration.stop();
                HermesBridgeMod.LOGGER.info("[HermesBridge] Auto-stopped mining {} after 10s", blockName);
            });
        }).start();

        return successResult("Mining " + blockName + " (auto-stops in 10s)");
    }

    // --- Approach block (sustained) — walk toward block until close, then aim ---
    private static void startApproachBlock(MinecraftClient client, JsonObject action, CompletableFuture<String> future) {
        if (!action.has("x") || !action.has("y") || !action.has("z")) {
            future.complete(errorResult("look_at_block requires x, y, z coordinates"));
            return;
        }
        ClientPlayerEntity player = client.player;
        if (player == null || client.world == null) {
            future.complete(errorResult("Not in game"));
            return;
        }

        int x = action.get("x").getAsInt();
        int y = action.get("y").getAsInt();
        int z = action.get("z").getAsInt();
        BlockPos pos = new BlockPos(x, y, z);

        double dist = Math.sqrt(player.getBlockPos().getSquaredDistance(pos));
        if (dist > 12) {
            future.complete(errorResult("Block too far (" + Math.round(dist) + " blocks). Use navigate to get closer."));
            return;
        }

        BlockState blockState = client.world.getBlockState(pos);
        String blockName = blockState.isAir() ? "air" : Registries.BLOCK.getId(blockState.getBlock()).getPath();

        // Already close enough — just aim and complete
        if (dist < 3.0) {
            lookAtPos(player, Vec3d.ofCenter(pos));
            future.complete(successResult("Looking at " + blockName + " at " + x + "," + y + "," + z + " (dist: " + Math.round(dist * 10.0) / 10.0 + ")"));
            return;
        }

        // Start sustained approach
        SustainedAction sa = new SustainedAction("look_at_block", future, 60); // 3 second timeout
        sa.approachTarget = pos;
        sa.approachBlockName = blockName;
        currentSustained = sa;

        // Face the block and start walking
        lookAtPos(player, Vec3d.ofCenter(pos));
        client.options.forwardKey.setPressed(true);

        HermesBridgeMod.LOGGER.info("[HermesBridge] Approaching {} at {} (dist: {})", blockName, pos, Math.round(dist));
    }

    private static void tickApproachBlock(MinecraftClient client, SustainedAction sa) {
        ClientPlayerEntity player = client.player;
        if (player == null) {
            client.options.forwardKey.setPressed(false);
            completeSustained(errorResult("Player disconnected"));
            return;
        }

        double dist = Math.sqrt(player.getBlockPos().getSquaredDistance(sa.approachTarget));

        // Re-aim each tick (player may have turned)
        lookAtPos(player, Vec3d.ofCenter(sa.approachTarget));

        // Close enough — stop and aim
        if (dist < 3.0) {
            client.options.forwardKey.setPressed(false);
            lookAtPos(player, Vec3d.ofCenter(sa.approachTarget));
            completeSustained(successResult("Looking at " + sa.approachBlockName + " at " +
                sa.approachTarget.getX() + "," + sa.approachTarget.getY() + "," + sa.approachTarget.getZ() +
                " (dist: " + Math.round(dist * 10.0) / 10.0 + ")"));
            return;
        }

        // Timeout — couldn't get close enough
        if (sa.ticksRemaining <= 0) {
            client.options.forwardKey.setPressed(false);
            completeSustained(errorResult("Could not reach block (dist: " + Math.round(dist) + "). Use navigate to get closer or try a different block."));
            return;
        }

        // Auto-jump if hitting a wall (velocity near zero while trying to walk)
        if (sa.ticksElapsed > 5 && player.isOnGround() && player.getVelocity().horizontalLengthSquared() < 0.001) {
            player.jump();
        }

        // Keep walking
        client.options.forwardKey.setPressed(true);
    }

    // --- Interact (right-click) block at coordinates — doors, chests, buttons, levers ---
    private static String handleInteractBlock(JsonObject action, MinecraftClient client) {
        if (!action.has("x") || !action.has("y") || !action.has("z")) {
            return errorResult("interact_block requires x, y, z coordinates");
        }
        ClientPlayerEntity player = client.player;
        if (player == null || client.interactionManager == null) return errorResult("Not in game");

        int x = action.get("x").getAsInt();
        int y = action.get("y").getAsInt();
        int z = action.get("z").getAsInt();
        BlockPos pos = new BlockPos(x, y, z);

        double dist = Math.sqrt(player.getBlockPos().getSquaredDistance(pos));
        if (dist > 6) {
            return errorResult("Block too far to interact (" + Math.round(dist) + " blocks). Get closer first.");
        }

        Vec3d center = Vec3d.ofCenter(pos);
        lookAtPos(player, center);

        BlockState blockState = client.world.getBlockState(pos);
        if (blockState.isAir()) {
            return errorResult("No block at " + x + "," + y + "," + z);
        }

        String blockName = Registries.BLOCK.getId(blockState.getBlock()).getPath();

        BlockHitResult hit = new BlockHitResult(center, Direction.UP, pos, false);
        client.interactionManager.interactBlock(player, Hand.MAIN_HAND, hit);
        player.swingHand(Hand.MAIN_HAND);

        return successResult("Interacted with " + blockName + " at " + x + "," + y + "," + z);
    }

    // --- Pickup items — walk in small area to collect drops ---
    private static void startPickupItems(MinecraftClient client, CompletableFuture<String> future) {
        ClientPlayerEntity player = client.player;
        if (player == null) {
            future.complete(errorResult("Not in game"));
            return;
        }

        SustainedAction sa = new SustainedAction("pickup_items", future, 30); // ~1.5 seconds
        sa.pickupPhase = 0;
        currentSustained = sa;

        // Start by walking forward briefly
        client.options.forwardKey.setPressed(true);
        HermesBridgeMod.LOGGER.info("[HermesBridge] Picking up items");
    }

    private static void tickPickupItems(MinecraftClient client, SustainedAction sa) {
        ClientPlayerEntity player = client.player;
        if (player == null) {
            completeSustained(errorResult("Player disconnected"));
            return;
        }

        // Walk in 4 directions, ~7 ticks each, to sweep the area
        int phase = sa.ticksElapsed / 7;
        if (phase != sa.pickupPhase) {
            sa.pickupPhase = phase;
            client.options.forwardKey.setPressed(false);
            switch (phase) {
                case 1 -> { player.setYaw(player.getYaw() + 90); client.options.forwardKey.setPressed(true); }
                case 2 -> { player.setYaw(player.getYaw() + 90); client.options.forwardKey.setPressed(true); }
                case 3 -> { player.setYaw(player.getYaw() + 90); client.options.forwardKey.setPressed(true); }
            }
        }

        if (sa.ticksRemaining <= 0 || phase >= 4) {
            client.options.forwardKey.setPressed(false);
            completeSustained(successResult("Swept area for item pickup"));
            return;
        }
    }

    // --- Craft items — sustained action with visual tick delays ---
    private static void startCraft(MinecraftClient client, JsonObject action, CompletableFuture<String> future) {
        if (!action.has("item")) {
            future.complete(errorResult("Craft requires 'item'"));
            return;
        }
        String itemName = action.get("item").getAsString();
        if (!itemName.contains(":")) itemName = "minecraft:" + itemName;

        ClientPlayerEntity player = client.player;
        if (player == null || client.world == null) {
            future.complete(errorResult("Not in game"));
            return;
        }

        // Find matching crafting recipe — try ALL recipes for this item,
        // prefer the one where the player actually has the ingredients
        List<RecipeEntry<?>> candidates = new java.util.ArrayList<>();

        for (RecipeEntry<?> entry : client.world.getRecipeManager().values()) {
            Recipe<?> recipe = entry.value();
            if (!(recipe instanceof CraftingRecipe)) continue;

            ItemStack output = recipe.getResult(client.world.getRegistryManager());
            String outputId = Registries.ITEM.getId(output.getItem()).toString();

            if (outputId.equals(itemName)) {
                candidates.add(entry);
            }
        }

        // Pick the best recipe — one where player has all ingredients
        RecipeEntry<?> matchingRecipe = null;
        boolean needsTable = false;

        ScreenHandler currentHandler = player.currentScreenHandler;
        boolean currentlyAtTable = currentHandler instanceof CraftingScreenHandler;
        int checkStart = currentlyAtTable ? 10 : 9;
        int checkEnd = currentlyAtTable ? 45 : 44;

        for (RecipeEntry<?> entry : candidates) {
            CraftingRecipe cr = (CraftingRecipe) entry.value();
            boolean hasAll = true;
            for (Ingredient ing : cr.getIngredients()) {
                if (ing.isEmpty()) continue;
                if (findIngredientSlot(currentHandler, ing, checkStart, checkEnd) == -1) {
                    hasAll = false;
                    break;
                }
            }
            if (hasAll) {
                matchingRecipe = entry;
                if (cr instanceof ShapedRecipe shaped) {
                    needsTable = shaped.getWidth() > 2 || shaped.getHeight() > 2;
                }
                if (cr.getIngredients().size() > 4) needsTable = true;
                break;
            }
        }

        // Fallback to first candidate if none have all ingredients
        if (matchingRecipe == null && !candidates.isEmpty()) {
            matchingRecipe = candidates.get(0);
            Recipe<?> r = matchingRecipe.value();
            if (r instanceof ShapedRecipe shaped) {
                needsTable = shaped.getWidth() > 2 || shaped.getHeight() > 2;
            }
            if (r.getIngredients().size() > 4) needsTable = true;
        }

        if (matchingRecipe == null) {
            future.complete(errorResult("No crafting recipe found for " + itemName));
            return;
        }

        ScreenHandler handler = player.currentScreenHandler;
        boolean isCraftingTable = handler instanceof CraftingScreenHandler;

        if (needsTable && !isCraftingTable) {
            BlockPos tablePos = findNearbyBlock(client, player, "minecraft:crafting_table", 5);
            if (tablePos == null) {
                future.complete(errorResult("Recipe requires crafting table but none within 5 blocks. Place one first."));
                return;
            }
            Vec3d center = Vec3d.ofCenter(tablePos);
            lookAtPos(player, center);
            BlockHitResult hit = new BlockHitResult(center, Direction.UP, tablePos, false);
            client.interactionManager.interactBlock(player, Hand.MAIN_HAND, hit);
            future.complete(successResult("Opening crafting table. Send craft command again next tick."));
            return;
        }

        if (!(matchingRecipe.value() instanceof CraftingRecipe craftRecipe)) {
            future.complete(errorResult("Internal error: not a crafting recipe"));
            return;
        }

        int gridWidth, invStart, invEnd;
        if (isCraftingTable) {
            gridWidth = 3; invStart = 10; invEnd = 45;
        } else {
            gridWidth = 2; invStart = 9; invEnd = 44;
        }

        // Pre-compute ingredient placements (non-empty ingredients + grid slot)
        List<Ingredient> ingredients = craftRecipe.getIngredients();
        int recipeWidth = craftRecipe instanceof ShapedRecipe shaped ? shaped.getWidth() : gridWidth;
        java.util.List<int[]> moves = new java.util.ArrayList<>();

        for (int idx = 0; idx < ingredients.size(); idx++) {
            Ingredient ing = ingredients.get(idx);
            if (ing.isEmpty()) continue;

            int gridSlot;
            if (craftRecipe instanceof ShapedRecipe) {
                int row = idx / recipeWidth;
                int col = idx % recipeWidth;
                gridSlot = row * gridWidth + col + 1;
            } else {
                gridSlot = idx + 1;
            }

            moves.add(new int[]{idx, gridSlot});
        }

        // Set up sustained crafting action: clear grid + N ingredients + take output
        int totalSteps = moves.size() + 2;
        SustainedAction sa = new SustainedAction("craft", future, totalSteps + 5);
        sa.craftRecipe = craftRecipe;
        sa.craftGridWidth = gridWidth;
        sa.craftInvStart = invStart;
        sa.craftInvEnd = invEnd;
        sa.craftStep = 0;
        sa.craftItemName = itemName;
        sa.craftMoves = moves;
        currentSustained = sa;

        HermesBridgeMod.LOGGER.info("[HermesBridge] Started crafting {} ({} ingredients)", itemName, moves.size());
    }

    private static void tickCraft(MinecraftClient client, SustainedAction sa) {
        ClientPlayerEntity player = client.player;
        if (player == null) {
            completeSustained(errorResult("Player disconnected during crafting"));
            return;
        }

        ScreenHandler handler = player.currentScreenHandler;
        int syncId = handler.syncId;
        int gridSize = sa.craftGridWidth * sa.craftGridWidth;

        if (sa.craftStep == 0) {
            // Step 0: Clear crafting grid
            for (int i = 1; i <= gridSize; i++) {
                if (!handler.getSlot(i).getStack().isEmpty()) {
                    client.interactionManager.clickSlot(syncId, i, 0, SlotActionType.QUICK_MOVE, player);
                }
            }
            sa.craftStep++;
            return;
        }

        int moveIndex = sa.craftStep - 1;
        if (moveIndex < sa.craftMoves.size()) {
            // Place one ingredient per tick
            int[] move = sa.craftMoves.get(moveIndex);
            int recipeIdx = move[0];
            int gridSlot = move[1];

            Ingredient ing = sa.craftRecipe.getIngredients().get(recipeIdx);
            int invSlot = findIngredientSlot(handler, ing, sa.craftInvStart, sa.craftInvEnd);

            if (invSlot == -1) {
                ItemStack[] matching = ing.getMatchingStacks();
                String needed = matching.length > 0
                    ? Registries.ITEM.getId(matching[0].getItem()).getPath()
                    : "unknown item";
                // Clean up partial grid
                for (int i = 1; i <= gridSize; i++) {
                    if (!handler.getSlot(i).getStack().isEmpty()) {
                        client.interactionManager.clickSlot(syncId, i, 0, SlotActionType.QUICK_MOVE, player);
                    }
                }
                completeSustained(errorResult("Missing ingredient: " + needed));
                return;
            }

            // Pick up from inventory, right-click grid to place 1, put rest back
            client.interactionManager.clickSlot(syncId, invSlot, 0, SlotActionType.PICKUP, player);
            client.interactionManager.clickSlot(syncId, gridSlot, 1, SlotActionType.PICKUP, player);
            client.interactionManager.clickSlot(syncId, invSlot, 0, SlotActionType.PICKUP, player);
            sa.craftStep++;
            return;
        }

        // Final step: take crafting output and close screen
        client.interactionManager.clickSlot(syncId, 0, 0, SlotActionType.QUICK_MOVE, player);
        player.closeHandledScreen();

        ItemStack output = sa.craftRecipe.getResult(client.world.getRegistryManager());
        String craftedName = Registries.ITEM.getId(output.getItem()).getPath();
        completeSustained(successResult("Crafted " + craftedName));
    }

    // --- Smelt items — sustained action with visual tick delays ---
    private static void startSmelt(MinecraftClient client, JsonObject action, CompletableFuture<String> future) {
        if (!action.has("item")) {
            future.complete(errorResult("Smelt requires 'item'"));
            return;
        }
        String itemName = action.get("item").getAsString();
        if (!itemName.contains(":")) itemName = "minecraft:" + itemName;
        ClientPlayerEntity player = client.player;

        if (!(player.currentScreenHandler instanceof AbstractFurnaceScreenHandler)) {
            BlockPos pos = findNearbyBlock(client, player, "minecraft:furnace", 5);
            if (pos == null) pos = findNearbyBlock(client, player, "minecraft:blast_furnace", 5);
            if (pos == null) pos = findNearbyBlock(client, player, "minecraft:smoker", 5);
            if (pos == null) {
                future.complete(errorResult("No furnace nearby. Craft and place one first."));
                return;
            }
            Vec3d center = Vec3d.ofCenter(pos);
            lookAtPos(player, center);
            BlockHitResult hit = new BlockHitResult(center, Direction.UP, pos, false);
            client.interactionManager.interactBlock(player, Hand.MAIN_HAND, hit);
            future.complete(successResult("Opening furnace. Send smelt command again next tick."));
            return;
        }

        // Set up sustained smelting: take output → load input → add fuel → done
        SustainedAction sa = new SustainedAction("smelt", future, 10);
        sa.smeltStep = 0;
        sa.smeltItemName = itemName;
        currentSustained = sa;

        HermesBridgeMod.LOGGER.info("[HermesBridge] Started smelting {}", itemName);
    }

    private static void tickSmelt(MinecraftClient client, SustainedAction sa) {
        ClientPlayerEntity player = client.player;
        if (player == null) {
            completeSustained(errorResult("Player disconnected during smelting"));
            return;
        }

        if (!(player.currentScreenHandler instanceof AbstractFurnaceScreenHandler furnace)) {
            completeSustained(errorResult("Furnace screen closed during smelting"));
            return;
        }

        int syncId = furnace.syncId;

        switch (sa.smeltStep) {
            case 0 -> {
                // Take output if available (slot 2)
                if (!furnace.getSlot(2).getStack().isEmpty()) {
                    String outputName = Registries.ITEM.getId(furnace.getSlot(2).getStack().getItem()).getPath();
                    int count = furnace.getSlot(2).getStack().getCount();
                    client.interactionManager.clickSlot(syncId, 2, 0, SlotActionType.QUICK_MOVE, player);
                    sa.smeltCollected = "Collected " + count + "x " + outputName + ". ";
                }
                sa.smeltStep++;
            }
            case 1 -> {
                // Add input item if slot 0 is empty
                if (furnace.getSlot(0).getStack().isEmpty()) {
                    int itemSlot = findItemSlot(furnace, sa.smeltItemName, 3, 38);
                    if (itemSlot != -1) {
                        client.interactionManager.clickSlot(syncId, itemSlot, 0, SlotActionType.PICKUP, player);
                        client.interactionManager.clickSlot(syncId, 0, 0, SlotActionType.PICKUP, player);
                    } else if (sa.smeltCollected == null) {
                        completeSustained(errorResult("Item not in inventory: " + sa.smeltItemName));
                        return;
                    }
                }
                sa.smeltStep++;
            }
            case 2 -> {
                // Add fuel if slot 1 is empty
                if (furnace.getSlot(1).getStack().isEmpty()) {
                    int fuelSlot = findFuelSlot(furnace, 3, 38);
                    if (fuelSlot != -1) {
                        client.interactionManager.clickSlot(syncId, fuelSlot, 0, SlotActionType.PICKUP, player);
                        client.interactionManager.clickSlot(syncId, 1, 0, SlotActionType.PICKUP, player);
                    }
                }
                sa.smeltStep++;
            }
            default -> {
                if (client.player != null) client.player.closeHandledScreen();
                String msg = (sa.smeltCollected != null ? sa.smeltCollected : "") + "Furnace active";
                completeSustained(successResult(msg.trim()));
            }
        }
    }

    // --- Wait (no-op) ---
    private static String handleWait() {
        return successResult("Waiting...");
    }

    // --- Close current screen ---
    private static String handleCloseScreen(MinecraftClient client) {
        if (client.player != null) {
            client.player.closeHandledScreen();
        }
        return successResult("Closed screen");
    }

    // --- Interact with entity (right-click, e.g. feeding animals for breeding) ---
    private static String handleInteractEntity(JsonObject action, MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        if (player == null || client.interactionManager == null) {
            return errorResult("Player not available");
        }

        String target = action.has("target") ? action.get("target").getAsString() : null;
        if (target == null) {
            return errorResult("interact_entity requires 'target' (entity type)");
        }

        // Equip the specified item if provided (e.g., wheat for cows)
        if (action.has("item")) {
            String itemName = action.get("item").getAsString();
            boolean found = selectHotbarItem(player, itemName);
            if (!found) {
                return errorResult("Item not found in hotbar: " + itemName);
            }
        }

        // Find nearest matching entity within 5 blocks
        double radius = 5.0;
        Box box = player.getBoundingBox().expand(radius);
        List<Entity> entities = client.world.getOtherEntities(player, box);

        Entity closest = null;
        double closestDist = Double.MAX_VALUE;

        for (Entity entity : entities) {
            if (!(entity instanceof LivingEntity)) continue;

            String entityPath = Registries.ENTITY_TYPE.getId(entity.getType()).getPath();
            if (!entityPath.contains(target)) continue;

            double dist = entity.distanceTo(player);
            if (dist < closestDist) {
                closestDist = dist;
                closest = entity;
            }
        }

        if (closest == null) {
            return errorResult("No " + target + " found within 5 blocks");
        }

        // Look at entity and right-click interact
        lookAtEntity(player, closest);
        client.interactionManager.interactEntity(player, closest, Hand.MAIN_HAND);
        player.swingHand(Hand.MAIN_HAND);

        String entityName = Registries.ENTITY_TYPE.getId(closest.getType()).getPath();
        return successResult("Interacted with " + entityName + " at distance " + Math.round(closestDist * 10.0) / 10.0);
    }

    // --- Attack nearest matching entity ---
    private static String handleAttack(JsonObject action, MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        ClientPlayerInteractionManager interactionManager = client.interactionManager;

        if (player == null || interactionManager == null) {
            return errorResult("Player not available");
        }

        String target = action.has("target") ? action.get("target").getAsString() : null;
        double radius = 5.0;

        Box box = player.getBoundingBox().expand(radius);
        List<Entity> entities = client.world.getOtherEntities(player, box);

        Entity closest = null;
        double closestDist = Double.MAX_VALUE;

        for (Entity entity : entities) {
            if (!(entity instanceof LivingEntity)) continue;

            if (target != null) {
                String entityId = Registries.ENTITY_TYPE.getId(entity.getType()).toString();
                String entityPath = Registries.ENTITY_TYPE.getId(entity.getType()).getPath();
                if (!entityId.contains(target) && !entityPath.contains(target)) {
                    continue;
                }
            }

            double dist = entity.distanceTo(player);
            if (dist < closestDist) {
                closestDist = dist;
                closest = entity;
            }
        }

        if (closest == null) {
            return errorResult("No matching entity found nearby" + (target != null ? " for: " + target : ""));
        }

        lookAtEntity(player, closest);
        interactionManager.attackEntity(player, closest);
        player.swingHand(Hand.MAIN_HAND);

        String entityName = Registries.ENTITY_TYPE.getId(closest.getType()).getPath();
        return successResult("Attacked " + entityName + " at distance " + Math.round(closestDist * 10.0) / 10.0);
    }

    // --- Place a block ---
    private static String handlePlace(JsonObject action, MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        if (player == null || client.interactionManager == null) {
            return errorResult("Player not available");
        }

        // Find the item in hotbar if specified
        if (action.has("item")) {
            String itemName = action.get("item").getAsString();
            boolean found = selectHotbarItem(player, itemName);
            if (!found) {
                return errorResult("Item not found in hotbar: " + itemName);
            }
        }

        int x, y, z;
        if (action.has("x") && action.has("y") && action.has("z")) {
            x = action.get("x").getAsInt();
            y = action.get("y").getAsInt();
            z = action.get("z").getAsInt();
        } else {
            // Default: place one block in front of the player at feet level
            double yawRad = Math.toRadians(player.getYaw());
            x = player.getBlockPos().getX() + (int) Math.round(-Math.sin(yawRad));
            y = player.getBlockPos().getY();
            z = player.getBlockPos().getZ() + (int) Math.round(Math.cos(yawRad));
        }

        BlockPos targetPos = new BlockPos(x, y, z);
        Vec3d targetVec = Vec3d.ofCenter(targetPos);
        lookAtPos(player, targetVec);

        BlockHitResult hitResult = new BlockHitResult(
                targetVec, Direction.UP, targetPos.down(), false
        );
        client.interactionManager.interactBlock(player, Hand.MAIN_HAND, hitResult);
        player.swingHand(Hand.MAIN_HAND);

        return successResult("Placed block at " + x + ", " + y + ", " + z);
    }

    // --- Equip item ---
    private static String handleEquip(JsonObject action, MinecraftClient client) {
        if (!action.has("item")) {
            return errorResult("Equip requires 'item'");
        }
        String itemName = action.get("item").getAsString();
        ClientPlayerEntity player = client.player;
        if (player == null) return errorResult("Player not available");

        int sourceSlot = -1;
        for (int i = 0; i < player.getInventory().size(); i++) {
            ItemStack stack = player.getInventory().getStack(i);
            if (!stack.isEmpty()) {
                String id = Registries.ITEM.getId(stack.getItem()).toString();
                String path = Registries.ITEM.getId(stack.getItem()).getPath();
                if (id.contains(itemName) || path.contains(itemName)) {
                    sourceSlot = i;
                    break;
                }
            }
        }

        if (sourceSlot == -1) {
            return errorResult("Item not found in inventory: " + itemName);
        }

        if (sourceSlot >= 9) {
            player.getInventory().selectedSlot = 0;
            if (client.interactionManager != null && player.currentScreenHandler != null) {
                client.interactionManager.clickSlot(
                        player.currentScreenHandler.syncId,
                        sourceSlot, 0, SlotActionType.SWAP, player
                );
            }
            return successResult("Equipped " + itemName + " to hotbar slot 0");
        } else {
            player.getInventory().selectedSlot = sourceSlot;
            return successResult("Selected " + itemName + " in slot " + sourceSlot);
        }
    }

    // --- Look direction ---
    private static String handleLook(JsonObject action, MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        if (player == null) return errorResult("Player not available");

        if (action.has("yaw")) {
            player.setYaw(action.get("yaw").getAsFloat());
        }
        if (action.has("pitch")) {
            player.setPitch(action.get("pitch").getAsFloat());
        }
        return successResult("Look direction set to yaw=" + player.getYaw() + " pitch=" + player.getPitch());
    }

    // --- Chat message ---
    private static String handleChat(JsonObject action, MinecraftClient client) {
        if (!action.has("message")) {
            return errorResult("Chat requires 'message'");
        }
        String message = action.get("message").getAsString();
        ClientPlayerEntity player = client.player;
        if (player == null) return errorResult("Player not available");

        // Cap at MC limit minus safety margin
        if (message.length() > 200) {
            message = message.substring(0, 200);
        }

        if (message.startsWith("/")) {
            client.getNetworkHandler().sendCommand(message.substring(1));
        } else {
            client.getNetworkHandler().sendChatMessage(message);
        }
        return successResult("Sent: " + message);
    }

    // --- Use held item ---
    private static String handleUseItem(MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        if (player == null || client.interactionManager == null) {
            return errorResult("Player not available");
        }
        client.interactionManager.interactItem(player, Hand.MAIN_HAND);
        player.swingHand(Hand.MAIN_HAND);
        String item = Registries.ITEM.getId(player.getMainHandStack().getItem()).getPath();
        return successResult("Used item: " + item);
    }

    // --- Drop items ---
    private static String handleDrop(JsonObject action, MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        if (player == null) return errorResult("Player not available");

        boolean dropAll = action.has("count") && action.get("count").getAsInt() == -1;

        if (action.has("item")) {
            String itemName = action.get("item").getAsString();
            boolean found = selectHotbarItem(player, itemName);
            if (!found) {
                return errorResult("Item not found in hotbar: " + itemName);
            }
        }

        player.dropSelectedItem(dropAll);
        return successResult("Dropped item" + (dropAll ? " (entire stack)" : ""));
    }

    // --- Swap hands ---
    private static String handleSwapHands(MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        if (player == null || player.currentScreenHandler == null || client.interactionManager == null) {
            return errorResult("Player not available");
        }
        client.interactionManager.clickSlot(
                player.currentScreenHandler.syncId,
                player.getInventory().selectedSlot, 40, SlotActionType.SWAP, player
        );
        return successResult("Swapped main hand and off hand");
    }

    // --- Stop all processes + sustained actions ---
    private static String handleStop(MinecraftClient client) {
        // Cancel any sustained action
        SustainedAction sa = currentSustained;
        if (sa != null) {
            currentSustained = null;
            if ("walk".equals(sa.type)) client.options.forwardKey.setPressed(false);
            if ("eat".equals(sa.type)) client.options.useKey.setPressed(false);
            if ("break_block".equals(sa.type) && client.interactionManager != null) {
                client.interactionManager.cancelBlockBreaking();
            }
            if ("look_at_block".equals(sa.type) || "pickup_items".equals(sa.type)) {
                client.options.forwardKey.setPressed(false);
            }
            if ("craft".equals(sa.type) || "smelt".equals(sa.type)) {
                if (client.player != null) {
                    client.player.closeHandledScreen();
                }
            }
            if (!sa.future.isDone()) {
                sa.future.complete(successResult("Stopped"));
            }
        }
        BaritoneIntegration.stop();
        return successResult("Stopped all pathfinding/mining");
    }

    // --- Jump ---
    private static String handleJump(MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        if (player == null) return errorResult("Player not available");
        if (player.isOnGround()) {
            player.jump();
            return successResult("Jumped");
        }
        return errorResult("Cannot jump — not on ground");
    }

    // --- Sneak toggle ---
    private static String handleSneak(JsonObject action, MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        if (player == null) return errorResult("Player not available");
        boolean enabled = action.has("enabled") ? action.get("enabled").getAsBoolean() : !player.isSneaking();
        player.setSneaking(enabled);
        return successResult("Sneaking: " + enabled);
    }

    // --- Sprint toggle ---
    private static String handleSprint(JsonObject action, MinecraftClient client) {
        ClientPlayerEntity player = client.player;
        if (player == null) return errorResult("Player not available");
        boolean enabled = action.has("enabled") ? action.get("enabled").getAsBoolean() : !player.isSprinting();
        player.setSprinting(enabled);
        return successResult("Sprinting: " + enabled);
    }

    // ===================== HELPERS =====================

    private static void lookAtEntity(ClientPlayerEntity player, Entity target) {
        Vec3d targetPos = target.getEyePos();
        lookAtPos(player, targetPos);
    }

    private static void lookAtPos(ClientPlayerEntity player, Vec3d target) {
        double dx = target.x - player.getX();
        double dy = target.y - player.getEyeY();
        double dz = target.z - player.getZ();
        double dist = Math.sqrt(dx * dx + dz * dz);

        float yaw = (float) (Math.toDegrees(Math.atan2(-dx, dz)));
        float pitch = (float) (Math.toDegrees(-Math.atan2(dy, dist)));

        player.setYaw(yaw);
        player.setPitch(pitch);
    }

    private static boolean selectHotbarItem(ClientPlayerEntity player, String itemName) {
        for (int i = 0; i < 9; i++) {
            ItemStack stack = player.getInventory().getStack(i);
            if (!stack.isEmpty()) {
                String id = Registries.ITEM.getId(stack.getItem()).toString();
                String path = Registries.ITEM.getId(stack.getItem()).getPath();
                if (id.contains(itemName) || path.contains(itemName)) {
                    player.getInventory().selectedSlot = i;
                    return true;
                }
            }
        }
        return false;
    }

    /** Find a specific block type within radius of the player */
    private static BlockPos findNearbyBlock(MinecraftClient client, ClientPlayerEntity player,
                                             String blockName, int radius) {
        World world = client.world;
        if (world == null) return null;

        BlockPos center = player.getBlockPos();
        Identifier targetId = blockName.contains(":")
            ? Identifier.of(blockName)
            : Identifier.ofVanilla(blockName);

        BlockPos closest = null;
        double closestDist = Double.MAX_VALUE;

        for (int dx = -radius; dx <= radius; dx++) {
            for (int dy = -radius; dy <= radius; dy++) {
                for (int dz = -radius; dz <= radius; dz++) {
                    BlockPos pos = center.add(dx, dy, dz);
                    Identifier blockId = Registries.BLOCK.getId(world.getBlockState(pos).getBlock());
                    if (blockId.equals(targetId)) {
                        double d = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        if (d < closestDist) {
                            closestDist = d;
                            closest = pos;
                        }
                    }
                }
            }
        }
        return closest;
    }

    /** Find a slot in the screen handler containing an item matching the ingredient */
    private static int findIngredientSlot(ScreenHandler handler, Ingredient ingredient,
                                           int start, int end) {
        ItemStack[] matching = ingredient.getMatchingStacks();
        for (int i = start; i <= end; i++) {
            ItemStack slotStack = handler.getSlot(i).getStack();
            if (slotStack.isEmpty()) continue;
            for (ItemStack match : matching) {
                if (slotStack.getItem() == match.getItem()) {
                    return i;
                }
            }
        }
        return -1;
    }

    /** Find a slot containing an item whose ID contains the given name */
    private static int findItemSlot(ScreenHandler handler, String itemName, int start, int end) {
        for (int i = start; i <= end; i++) {
            ItemStack stack = handler.getSlot(i).getStack();
            if (stack.isEmpty()) continue;
            String id = Registries.ITEM.getId(stack.getItem()).toString();
            String path = Registries.ITEM.getId(stack.getItem()).getPath();
            if (id.contains(itemName) || path.contains(itemName)) {
                return i;
            }
        }
        return -1;
    }

    /** Find a fuel item in the player inventory section of a screen handler */
    private static int findFuelSlot(ScreenHandler handler, int start, int end) {
        // Priority: pure fuels first, then wood-based
        String[] pureFuels = {"coal", "charcoal", "lava_bucket", "blaze_rod"};
        for (String fuel : pureFuels) {
            int slot = findItemSlot(handler, fuel, start, end);
            if (slot != -1) return slot;
        }
        String[] woodFuels = {"planks", "log", "stick", "wood"};
        for (String fuel : woodFuels) {
            int slot = findItemSlot(handler, fuel, start, end);
            if (slot != -1) return slot;
        }
        return -1;
    }

    private static String successResult(String message) {
        JsonObject obj = new JsonObject();
        obj.addProperty("success", true);
        obj.addProperty("message", message);
        return obj.toString();
    }

    private static String errorResult(String message) {
        JsonObject obj = new JsonObject();
        obj.addProperty("success", false);
        obj.addProperty("message", message);
        return obj.toString();
    }
}
