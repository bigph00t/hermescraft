// Society Orchestration
// Main interface for civilization management

const MinecraftCivilization = require('./civilization');
const AgentIdentity = require('./identity');

class SocietyManager {
    constructor() {
        this.civilizations = new Map();
    }
    
    createCivilization(name) {
        const civilization = new MinecraftCivilization(name);
        this.civilizations.set(name, civilization);
        console.log(`Created civilization: ${name}`);
        return civilization;
    }
    
    startAllCivilizations() {
        this.civilizations.forEach(civilization => {
            civilization.startCivilization();
        });
    }
    
    addIdentity(civilizationName, name, role, specialization) {
        const civilization = this.civilizations.get(civilizationName);
        if (civilization) {
            civilization.addIdentity(name, role, specialization);
        }
    }
}

module.exports = SocietyManager;
