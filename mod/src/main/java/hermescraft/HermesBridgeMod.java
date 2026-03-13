package hermescraft;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class HermesBridgeMod implements ClientModInitializer {

    public static final String MOD_ID = "hermesbridge";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    private HttpServer httpServer;
    private int tickCounter = 0;

    @Override
    public void onInitializeClient() {
        LOGGER.info("[HermesBridge] Initializing HermesBridge mod...");

        try {
            httpServer = new HttpServer(3001);
            httpServer.start();
            LOGGER.info("[HermesBridge] HTTP server started on port 3001");
        } catch (Exception e) {
            LOGGER.error("[HermesBridge] Failed to start HTTP server", e);
        }

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            tickCounter++;
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
