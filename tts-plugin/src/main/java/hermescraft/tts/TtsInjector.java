// TtsInjector.java — HTTP server on port 8765 + EntityAudioChannel audio injection via Simple Voice Chat API
package hermescraft.tts;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import de.maxhenkel.voicechat.api.VoicechatApi;
import de.maxhenkel.voicechat.api.VoicechatPlugin;
import de.maxhenkel.voicechat.api.VoicechatServerApi;
import de.maxhenkel.voicechat.api.audiochannel.AudioPlayer;
import de.maxhenkel.voicechat.api.audiochannel.EntityAudioChannel;
import org.bukkit.entity.Player;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.Executors;

public class TtsInjector implements VoicechatPlugin {

    // Frame size: 48kHz * 0.020s = 960 samples per frame — HARDCODED per Simple Voice Chat API requirement
    private static final int FRAME_SIZE = 960;

    private final TtsPlugin plugin;
    private VoicechatServerApi voicechatApi;
    private HttpServer httpServer;
    private final Gson gson = new Gson();

    public TtsInjector(TtsPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public String getPluginId() {
        return "hermescraft-tts";
    }

    @Override
    public void initialize(VoicechatApi api) {
        this.voicechatApi = (VoicechatServerApi) api;

        try {
            httpServer = HttpServer.create(new InetSocketAddress(8765), 0);
            httpServer.createContext("/tts", this::handleTts);
            httpServer.setExecutor(Executors.newSingleThreadExecutor());
            httpServer.start();
            plugin.getLogger().info("[tts-plugin] HTTP server started on port 8765");
        } catch (IOException e) {
            plugin.getLogger().severe("[tts-plugin] Failed to start HTTP server: " + e.getMessage());
        }
    }

    private void handleTts(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendResponse(exchange, 405, "{\"error\":\"method not allowed\"}");
            return;
        }

        try {
            // Read request body
            InputStream body = exchange.getRequestBody();
            String requestBody = new String(body.readAllBytes(), StandardCharsets.UTF_8);

            // Parse JSON: { "agent": "luna", "pcm_b64": "<base64>" }
            JsonObject json = gson.fromJson(requestBody, JsonObject.class);
            String agentName = json.get("agent").getAsString();
            String pcmB64 = json.get("pcm_b64").getAsString();

            // Case-insensitive player lookup
            Player player = plugin.getServer().getPlayer(agentName);
            if (player == null) {
                // Try case-insensitive search
                for (Player p : plugin.getServer().getOnlinePlayers()) {
                    if (p.getName().equalsIgnoreCase(agentName)) {
                        player = p;
                        break;
                    }
                }
            }

            if (player == null) {
                sendResponse(exchange, 404, "{\"error\":\"player not found\",\"agent\":\"" + agentName + "\"}");
                return;
            }

            // Decode base64 PCM to byte[] then convert to short[]
            byte[] pcmBytes = Base64.getDecoder().decode(pcmB64);
            short[] allSamples = pcmBytesToShorts(pcmBytes);

            // Create EntityAudioChannel keyed on the speaking player entity
            EntityAudioChannel channel = voicechatApi.createEntityAudioChannel(
                UUID.randomUUID(),
                voicechatApi.fromEntity(player)
            );
            channel.setDistance(48); // 48-block proximity radius

            // Frame supplier: returns 960-sample frames sequentially, pads last frame, returns null when done
            int totalFrames = (int) Math.ceil((double) allSamples.length / FRAME_SIZE);
            final int[] frameIndex = {0};

            AudioPlayer audioPlayer = voicechatApi.createAudioPlayer(
                channel,
                voicechatApi.createEncoder(),
                () -> {
                    int start = frameIndex[0]++ * FRAME_SIZE;
                    if (start >= allSamples.length) return null; // null signals stop
                    // Copy range and pad last frame to exactly FRAME_SIZE with zeros
                    short[] frame = Arrays.copyOf(
                        Arrays.copyOfRange(allSamples, start, Math.min(start + FRAME_SIZE, allSamples.length)),
                        FRAME_SIZE
                    );
                    return frame;
                }
            );

            audioPlayer.startPlaying();

            String responseJson = "{\"ok\":true,\"frames\":" + totalFrames + "}";
            sendResponse(exchange, 200, responseJson);

        } catch (Exception e) {
            plugin.getLogger().warning("[tts-plugin] Error handling /tts request: " + e.getMessage());
            sendResponse(exchange, 500, "{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}");
        }
    }

    /**
     * Convert raw PCM bytes (16-bit little-endian) to short array
     */
    private static short[] pcmBytesToShorts(byte[] bytes) {
        short[] shorts = new short[bytes.length / 2];
        ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(shorts);
        return shorts;
    }

    private void sendResponse(HttpExchange exchange, int statusCode, String body) throws IOException {
        byte[] responseBytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(statusCode, responseBytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(responseBytes);
        }
    }
}
