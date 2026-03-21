# Building Knowledge

## How to Build
You have a `build` tool that constructs structures from blueprints. Available blueprints:
- **small-cabin**: 5x5 wooden house with walls, roof, door, floor. Good first shelter.
- **animal-pen**: 7x7 fenced area with gate. For keeping animals.
- **crop-farm**: 9x9 farm plot with water channel. For growing wheat and crops.

## Using the Build Tool
1. Choose a FLAT area near your current position for the build site
2. The origin (x, y, z) is the front-left corner at ground level
3. Call: build(blueprint="small-cabin", x=..., y=..., z=...)
4. Building happens automatically -- blocks are placed layer by layer
5. If you run out of materials, building pauses. Gather what's needed and it resumes.

## Site Selection
- Build on FLAT ground. Avoid slopes, water edges, cliff edges.
- Use coordinates from your position or nearbyBlocks to pick a spot
- Leave space between structures (at least 5 blocks apart)
- Build near resources: wood for cabins, near water for farms

## Material Planning
- Before building, check your inventory for the required materials
- A small cabin needs ~80-100 wood blocks (planks + logs)
- Gather materials BEFORE starting the build for best results
- If you're short on materials, building will pause -- go gather more

## Building Principles
- Foundation first, then walls, then roof -- the build tool handles this order
- Use materials you HAVE. Oak near oak forests, stone near caves.
- Don't mix wood types randomly -- pick one type and stick with it
- Place a crafting table and furnace inside your cabin after building

## After Building
- Place torches inside and around your structure for light and safety
- Add a door if the blueprint didn't include one
- Store items in a chest inside your home
- Remember where you built -- this is your base
