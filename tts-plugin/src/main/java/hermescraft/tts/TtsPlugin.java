// TtsPlugin.java — Paper plugin entrypoint: registers TTS audio injection with Simple Voice Chat
package hermescraft.tts;

import de.maxhenkel.voicechat.api.BukkitVoicechatService;
import org.bukkit.plugin.java.JavaPlugin;

public class TtsPlugin extends JavaPlugin {

    @Override
    public void onEnable() {
        getLogger().info("HermesCraftTTS plugin enabled");
        try {
            BukkitVoicechatService service = getServer().getServicesManager().load(BukkitVoicechatService.class);
            if (service == null) {
                getLogger().warning("[tts-plugin] BukkitVoicechatService not available — is Simple Voice Chat loaded?");
                return;
            }
            service.registerPlugin(new TtsInjector(this));
            getLogger().info("[tts-plugin] Registered TtsInjector with Simple Voice Chat");
        } catch (Exception e) {
            getLogger().severe("[tts-plugin] Failed to register with Simple Voice Chat: " + e.getMessage());
        }
    }

    @Override
    public void onDisable() {
        getLogger().info("HermesCraftTTS plugin disabled");
    }
}
