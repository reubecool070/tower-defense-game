const DEFAULT_ROWS = 10;
const DEFAULT_COLS = 10;
const START_NODE_ROW = 0;
const START_NODE_COLUMN = 5;
const FINISH_NODE_ROW = 9;
const FINISH_NODE_COLUMN = 0;
const GROUND_Z_OFFSET = 0.01;
const GROUND_HEIGHT = 0.25 + GROUND_Z_OFFSET;

// Tower and particle constants
const TOWER_FIRE_RATE = 0.3; // 2 times per second
const PARTICLE_SPEED = 15.0; // Base speed multiplier
const TOWER_RANGE = 3.0; // How far towers can detect minions

// Minion constants
const MINION_MAX_HEALTH = 100;
const PARTICLE_DAMAGE = 1;
const DEATH_FADE_DURATION = 1.5; // seconds for death animation
const MINION_COUNT = 5; // Number of minions to create
const MINION_SPAWN_DELAY = 2; // Seconds between minion spawns

export {
  DEFAULT_ROWS,
  DEFAULT_COLS,
  START_NODE_ROW,
  START_NODE_COLUMN,
  FINISH_NODE_ROW,
  FINISH_NODE_COLUMN,
  GROUND_Z_OFFSET,
  GROUND_HEIGHT,
  TOWER_FIRE_RATE,
  PARTICLE_SPEED,
  TOWER_RANGE,
  MINION_MAX_HEALTH,
  PARTICLE_DAMAGE,
  DEATH_FADE_DURATION,
  MINION_COUNT,
  MINION_SPAWN_DELAY,
};
