package hermescraft;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.gui.screen.multiplayer.ConnectScreen;
import net.minecraft.client.network.ServerAddress;
import net.minecraft.client.network.ServerInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.ConcurrentLinkedDeque;

public class HermesBridgeMod implements ClientModInitializer {

    public static final String MOD_ID = "hermesbridge";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    // Ring buffer for recent chat messages (thread-safe)
    private static final ConcurrentLinkedDeque<String> chatMessages = new ConcurrentLinkedDeque<>();
    private static final int MAX_CHAT_MESSAGES = 20;

    private HttpServer httpServer;
    private int tickCounter = 0;
    private boolean autoConnectAttempted = false;
    private boolean wasConnected = false;

    /**
     * Add a chat message to the ring buffer.
     */
    public static void addChatMessage(String message) {
        chatMessages.addLast(message);
        while (chatMessages.size() > MAX_CHAT_MESSAGES) {
            chatMessages.pollFirst();
        }
    }

    /**
     * Get recent chat messages as newline-delimited string.
     */
    public static String getRecentChat() {
        return String.join("\n", chatMessages);
    }

    /**
     * Get chat messages as a list (for JSON serialization).
     */
    public static java.util.List<String> getChatList() {
        return new java.util.ArrayList<>(chatMessages);
    }

    @Override
    public void onInitializeClient() {
        LOGGER.info("[HermesBridge] Initializing HermesBridge mod...");

        try {
            int port = 3001;
            String envPort = System.getenv("HERMESCRAFT_PORT");
            if (envPort != null && !envPort.isEmpty()) {
                try { port = Integer.parseInt(envPort); } catch (NumberFormatException ignored) {}
            }
            httpServer = new HttpServer(port);
            httpServer.start();
            LOGGER.info("[HermesBridge] HTTP server started on port " + port);
        } catch (Exception e) {
            LOGGER.error("[HermesBridge] Failed to start HTTP server", e);
        }

        // Capture incoming game messages (system, advancements, join/leave)
        ClientReceiveMessageEvents.GAME.register((message, overlay) -> {
            if (!overlay) {
                String text = message.getString();
                addChatMessage(text);
            }
        });

        // Capture player chat messages (typed by players)
        ClientReceiveMessageEvents.CHAT.register((message, signedMessage, sender, params, receptionTimestamp) -> {
            String text = message.getString();
            addChatMessage(text);
        });

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            tickCounter++;

            // Detect player disconnect — reset auto-connect flag so we can reconnect
            if (wasConnected && client.player == null) {
                LOGGER.info("[HermesBridge] Player disconnected — will auto-reconnect");
                autoConnectAttempted = false;
            }
            wasConnected = client.player != null;

            // Auto-connect to server — retry every 100 ticks until connected
            if (!autoConnectAttempted && tickCounter > 200 && tickCounter % 100 == 0 && client.player == null) {
                String serverAddr = System.getenv("HERMESCRAFT_SERVER");
                if (serverAddr == null || serverAddr.isEmpty()) {
                    serverAddr = "localhost:25565";
                }
                autoConnectAttempted = true;
                LOGGER.info("[HermesBridge] Auto-connecting to " + serverAddr);
                try {
                    ServerAddress addr = ServerAddress.parse(serverAddr);
                    ServerInfo info = new ServerInfo("HermesCraft", serverAddr, ServerInfo.ServerType.OTHER);
                    ConnectScreen.connect(client.currentScreen, client, addr, info, false, null);
                } catch (Exception e) {
                    LOGGER.error("[HermesBridge] Auto-connect failed", e);
                    autoConnectAttempted = false; // Retry next cycle
                }
            }

            // Process pending actions EVERY tick (critical for sustained actions)
            ActionExecutor.processTick(client);
            // Periodic state cache update every 20 ticks (1 second)
            if (tickCounter % 20 == 0) {
                StateReader.updateCachedState();
            }
            // Auto-respawn on death (every 40 ticks = 2 seconds delay)
            if (tickCounter % 40 == 0 && client.player != null && client.player.isDead()) {
                client.player.requestRespawn();
                LOGGER.info("[HermesBridge] Auto-respawned after death");
            }
        });

        LOGGER.info("[HermesBridge] HermesBridge mod initialized successfully");
    }
}
