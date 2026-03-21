package hermescraft;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class HttpServer {

    private final com.sun.net.httpserver.HttpServer server;

    public HttpServer(int port) throws IOException {
        server = com.sun.net.httpserver.HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
        server.setExecutor(Executors.newFixedThreadPool(4));

        server.createContext("/health", new HealthHandler());
        server.createContext("/state", new StateHandler());
        server.createContext("/action", new ActionHandler());
        server.createContext("/recipes", new RecipeHandler());
        server.createContext("/chat", new ChatHandler());
        server.createContext("/screenshot", new ScreenshotHandler());
    }

    public void start() {
        server.start();
    }

    public void stop() {
        server.stop(0);
    }

    private static void sendResponse(HttpExchange exchange, int statusCode, String body) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");

        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String readRequestBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    // GET /health
    static class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 204, "");
                return;
            }
            JsonObject response = new JsonObject();
            response.addProperty("status", "ok");
            response.addProperty("mod", "hermesbridge");
            response.addProperty("version", "1.0.0");
            sendResponse(exchange, 200, response.toString());
        }
    }

    // GET /state
    static class StateHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 204, "");
                return;
            }
            try {
                String state = StateReader.getState();
                sendResponse(exchange, 200, state);
            } catch (Exception e) {
                HermesBridgeMod.LOGGER.error("[HermesBridge] Error reading state", e);
                JsonObject error = new JsonObject();
                error.addProperty("error", "Failed to read game state: " + e.getMessage());
                sendResponse(exchange, 500, error.toString());
            }
        }
    }

    // POST /action
    static class ActionHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 204, "");
                return;
            }
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                JsonObject error = new JsonObject();
                error.addProperty("error", "Method not allowed. Use POST.");
                sendResponse(exchange, 405, error.toString());
                return;
            }
            try {
                String body = readRequestBody(exchange);
                if (body == null || body.isBlank()) {
                    JsonObject error = new JsonObject();
                    error.addProperty("error", "Empty request body");
                    sendResponse(exchange, 400, error.toString());
                    return;
                }
                JsonObject action = JsonParser.parseString(body).getAsJsonObject();
                String result = ActionExecutor.execute(action);
                sendResponse(exchange, 200, result);
            } catch (Exception e) {
                HermesBridgeMod.LOGGER.error("[HermesBridge] Error executing action", e);
                JsonObject error = new JsonObject();
                error.addProperty("error", "Action execution failed: " + e.getMessage());
                sendResponse(exchange, 500, error.toString());
            }
        }
    }

    // GET /chat — recent chat messages
    static class ChatHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 204, "");
                return;
            }
            String chat = HermesBridgeMod.getRecentChat();
            exchange.getResponseHeaders().set("Content-Type", "text/plain");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            byte[] bytes = chat.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }
    }

    // GET /screenshot — capture framebuffer as PNG
    static class ScreenshotHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 204, "");
                return;
            }
            try {
                byte[] png = HermesBridgeMod.captureScreenshot().get(5, TimeUnit.SECONDS);
                if (png == null || png.length == 0) {
                    sendResponse(exchange, 500, "{\"error\":\"Screenshot capture failed\"}");
                    return;
                }
                exchange.getResponseHeaders().set("Content-Type", "image/png");
                exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
                exchange.sendResponseHeaders(200, png.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(png);
                }
            } catch (Exception e) {
                HermesBridgeMod.LOGGER.error("[HermesBridge] Screenshot endpoint error", e);
                sendResponse(exchange, 500, "{\"error\":\"Screenshot failed: " + e.getMessage() + "\"}");
            }
        }
    }

    // GET /recipes?item=X
    static class RecipeHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 204, "");
                return;
            }
            try {
                String query = exchange.getRequestURI().getQuery();
                String item = null;
                if (query != null) {
                    for (String param : query.split("&")) {
                        String[] kv = param.split("=", 2);
                        if (kv.length == 2 && "item".equals(kv[0])) {
                            item = kv[1];
                        }
                    }
                }
                if (item == null || item.isBlank()) {
                    JsonObject error = new JsonObject();
                    error.addProperty("error", "Missing 'item' query parameter");
                    sendResponse(exchange, 400, error.toString());
                    return;
                }
                String result = RecipeLookup.lookup(item);
                sendResponse(exchange, 200, result);
            } catch (Exception e) {
                HermesBridgeMod.LOGGER.error("[HermesBridge] Error looking up recipe", e);
                JsonObject error = new JsonObject();
                error.addProperty("error", "Recipe lookup failed: " + e.getMessage());
                sendResponse(exchange, 500, error.toString());
            }
        }
    }
}
