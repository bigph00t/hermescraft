package hermescraft;

import net.minecraft.client.MinecraftClient;

/**
 * Baritone integration via chat commands.
 * Baritone intercepts chat messages starting with # via Fabric mixins.
 * This works regardless of API class obfuscation in standalone builds.
 */
public class BaritoneIntegration {

    private static boolean baritoneAvailable = false;
    private static boolean checkedAvailability = false;

    private static void ensureChecked() {
        if (checkedAvailability) return;
        checkedAvailability = true;
        try {
            // Check if any Baritone class is present
            Class.forName("baritone.BaritoneProvider");
            baritoneAvailable = true;
            HermesBridgeMod.LOGGER.info("[HermesBridge] Baritone detected — using chat command interface");
        } catch (ClassNotFoundException e) {
            HermesBridgeMod.LOGGER.info("[HermesBridge] Baritone not found — navigation/mining disabled");
        }
    }

    private static boolean sendBaritoneCommand(String command) {
        ensureChecked();
        if (!baritoneAvailable) return false;

        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null || client.player == null || client.getNetworkHandler() == null) return false;

        try {
            // Baritone intercepts chat messages starting with # via mixin
            client.getNetworkHandler().sendChatMessage(command);
            HermesBridgeMod.LOGGER.info("[HermesBridge] Baritone command: {}", command);
            return true;
        } catch (Exception e) {
            HermesBridgeMod.LOGGER.error("[HermesBridge] Baritone command failed: {}", command, e);
            return false;
        }
    }

    public static boolean navigate(int x, int y, int z) {
        return sendBaritoneCommand("#goto " + x + " " + y + " " + z);
    }

    public static boolean mine(String blockName, int count) {
        String name = blockName.replace("minecraft:", "");
        return sendBaritoneCommand("#mine " + name);
    }

    public static void stop() {
        sendBaritoneCommand("#stop");
    }

    public static boolean isPathing() {
        // Cannot reliably check via chat commands — return false
        // The agent uses position change detection as a fallback
        return false;
    }

    public static String getGoalStatus() {
        return baritoneAvailable ? "Baritone available (chat mode)" : "Baritone not available";
    }

    public static boolean isAvailable() {
        ensureChecked();
        return baritoneAvailable;
    }
}
