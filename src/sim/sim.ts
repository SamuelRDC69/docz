import type {
  AccountCosmetics,
  DelveCompanionInfo,
  DelveRunInfo,
  LockpickView,
} from '../world_api';
import { type AssistCandidate, resolveAssist } from './assist';
import { lineOfSightClear, resolveMovement, resolvePosition } from './colliders';
import {
  cleanseFriendlyNpcAuras,
  isRejectedFriendlyNpcAura,
  updateAuras,
  updateRegen,
  updateTimers,
} from './combat/auras';
import {
  cancelCast as cancelCastImpl,
  castAbility as castAbilityImpl,
  castAbilityBySlot as castAbilityBySlotImpl,
  pushbackCast as pushbackCastImpl,
  spendResource as spendResourceImpl,
  updateCasting as updateCastingImpl,
} from './combat/casting_lifecycle';
import {
  blindMissBonus,
  isDisarmed,
  isLockedOut,
  isRooted,
  isSilenced,
  isStunned,
  tonguesMult,
} from './combat/cc';
import {
  dealDamage as dealDamageImpl,
  grantXp as grantXpImpl,
  handleDeath as handleDeathImpl,
} from './combat/damage';
import {
  applyHeal as applyHealImpl,
  consumeHealAbsorb as consumeHealAbsorbImpl,
  critVulnBonus as critVulnBonusImpl,
  healingTakenMult as healingTakenMultImpl,
  healingThreat as healingThreatImpl,
  hexOutputMult as hexOutputMultImpl,
} from './combat/heal';
// A3: the augment/power-up content helpers used by the Fiesta match logic
// (AUGMENTS_BY_ID/AugmentDef/eligibleAugments/POWERUPS/PowerupDef/tierForWave)
// moved to social/fiesta.ts with that logic; sim.ts keeps only the type used by
// the PlayerMeta interface + the power-up catalog the fiestaMatchInfo accessor reads.
import { type AugmentSpecial, type AugmentTier, POWERUPS_BY_ID } from './content/augments';
import {
  delveChestItemsForTier,
  LOCKPICK_TIER_REWARD,
  lockpickPresetFor,
} from './content/delves/lockpick_tiers';
import {
  classHasSkin,
  EVENT_SKIN_TOKEN_ID,
  MECH_CHROMAS,
  mechChromaItemId,
  mechChromaSkinIndex,
  rankAllowsMechChroma,
  rankAllowsSkin,
  rollSkinRank,
} from './content/skins';
import {
  cloneAllocation,
  computeTalentModifiers,
  defaultBuild,
  emptyAllocation,
  emptyModifiers,
  FIRST_TALENT_LEVEL,
  pointsSpent,
  type Role,
  type SavedLoadout,
  type TalentAllocation,
  type TalentModifiers,
  talentPointsAtLevel,
  talentsFor,
} from './content/talents';
import type { DelveShopGate, DelveShopOffer } from './data';
import {
  ABILITIES,
  abilitiesKnownAt,
  arenaOrigin,
  CAMPS,
  CLASSES,
  DEEPFEN_SHALLOWS_LAKE,
  DELVE_COMPANIONS,
  DELVE_LIST,
  DELVE_SLOT_COUNT,
  DELVES,
  DUNGEON_LIST,
  DUNGEON_X_THRESHOLD,
  DUNGEONS,
  delveAt,
  delveOrigin,
  dungeonAt,
  FISHING_RARE_ID,
  FISHING_TABLES,
  GROUND_OBJECTS,
  INSTANCE_SLOT_COUNT,
  ITEMS,
  isDelvePos,
  MOBS,
  NPCS,
  PLAYER_START,
  PROPS,
  QUESTS,
  questRewardItemId,
  resolveDelveShopOffers,
  ZONES,
  zoneAt,
} from './data';
// A3: ARENA_SPAWNS_A_2v2/B_2v2 (read only by the moved fiestaRevive) now live with
// social/fiesta.ts; the dungeon-wall consts stay (non-Fiesta callers). I2a's delve
// move also dropped the now-unused delve_layout import (DELVE_MODULE_LAYOUTS et al.).
import { DUNGEON_WALL_HW, DUNGEON_WALL_X } from './dungeon_layout';
import {
  createGroundObject,
  createMob,
  createNpc,
  createPlayer,
  type PlayerEquipment,
  recalcPlayerStats,
} from './entity';
import { canEquipItem } from './equipment_rules';
import {
  LEADERBOARD_PAGE_SIZE,
  type LeaderboardPage,
  paginateLeaderboard,
} from './leaderboard_page';
import {
  ANTE_TO_PAGES,
  ANTE_TO_STEP_TIMEOUT_MS,
  ANTE_TO_TIER,
  ANTE_TO_TRIES,
  type Ante,
  generateLockPages,
  type LockSession,
  type PickAction,
  stepLock,
  visibleCells,
} from './lockpick';
import {
  isTrivialTo as isTrivialToFn,
  retargetMob as retargetMobFn,
  updateMobTarget as updateMobTargetFn,
} from './mob/targeting';
import { resetEvadingMob as resetEvadingMobFn, updateMob as updateMobFn } from './mob/locomotion';
import { runMobSwingAffixes } from './mob/mob_swing';
import { combatProfileForMob, effectiveMobMeleeRange, type MobCombatProfile } from './mob_combat';
import {
  findPlayerPath,
  PLAYER_BODY_RADIUS,
  PLAYER_MAX_CLIMB_SLOPE,
  PLAYER_SWIM_DEPTH,
} from './pathfind';
import { questFallbackGrants } from './quest_fallback';
import { sanitizeRemovedZone1Content } from './removed_zone1_content';
import { Rng } from './rng';
import {
  addEntityToRoster,
  type DelayedEvent,
  drainDelayedEvents,
  dropEntityFromRoster,
  graveyardReadout,
  type GroundAoE,
  rebucketEntity,
  releasePlayerSpirit,
  releaseSpiritInDelve as releaseSpiritInDelveImpl,
  runDespawnDecay,
  tickGroundAoEs,
} from './entity_roster';
import {
  applyTalentAllocation,
  deleteTalentLoadout,
  respecTalents,
  saveTalentLoadout,
  setTalentSpec,
  spendTalentPoint,
  switchTalentLoadout,
  talentPointBudget,
} from './progression/talents';
import * as runsMod from './delves/runs';
import { createSimContext, type SimContext, type SimContextHost } from './sim_context';
import {
  enterCrypt as enterCryptImpl,
  enterDungeon as enterDungeonImpl,
  instanceKeyFor as instanceKeyForImpl,
  instanceOriginOf as instanceOriginOfImpl,
  instanceSlotAt as instanceSlotAtImpl,
  leaveCrypt as leaveCryptImpl,
  leaveDungeon as leaveDungeonImpl,
  updateDoorTriggers as updateDoorTriggersImpl,
  updateInstances as updateInstancesImpl,
} from './instances/dungeons';
import { checkQuestReady, onInventoryChangedForQuests, onMobKilledForQuests } from './quests/quest_credit';
import * as arenaMod from './social/arena';
import * as duelMod from './social/duel';
// A2: eloDelta (with ARENA_K_FACTOR) moved to social/arena.ts. Re-exported so the
// public path `import { Sim, eloDelta } from './sim'` (tests/arena.test.ts) holds.
export { eloDelta } from './social/arena';
import * as fiestaMod from './social/fiesta';
// A3: Fiesta tuning consts moved to social/fiesta.ts; these five are read back here
// by the fiestaMatchInfo presentation accessor (which STAYS on Sim).
import {
  FIESTA_POWERUP_TELEGRAPH,
  FIESTA_POWERUP_TTL,
  FIESTA_RING_CX,
  FIESTA_RING_CZ,
  FIESTA_TOTAL_WAVES,
} from './social/fiesta';
import * as fiestaBotsMod from './social/fiesta_bots';
import { PartyMachine } from './social/party';
import { SpatialGrid } from './spatial';
import { orderTabTargets, TAB_QUERY_RADIUS } from './tab_target';
import {
  addThreat,
  clearThreat,
  stealthDetectionRadius,
  TAUNT_FORCE_SECONDS,
  threatEntries,
  threatModifier,
  topThreatValue,
} from './threat';
import {
  type AbilityDef,
  type AbilityEffect,
  type ArenaCombatant,
  type ArenaFormat,
  type ArenaStanding,
  type Aura,
  type AuraKind,
  angleTo,
  armorReduction,
  DEMON_HEAL_CAST_ID,
  CONSUME_DURATION,
  CONSUME_TICKS,
  type CrowdControlDrCategory,
  type CurrencyLootStrategy,
  canPrestige,
  DELVE_COMPANION_MAX_RANK,
  DELVE_PLATE_RADIUS,
  type DelveDef,
  type DelveModuleDef,
  type DelveObjectState,
  type DelveRun,
  DT,
  dist2d,
  DUNGEON_LEASH_DISTANCE,
  type Entity,
  type EquipSlot,
  type ErrorReason,
  emptyMoveInput,
  FISHING_CAST_ID,
  FISHING_CAST_TIME,
  GCD,
  INSTANCE_EMPTY_TIMEOUT,
  INTERACT_RANGE,
  type InvSlot,
  type ItemDef,
  type ItemLootStrategy,
  isConsuming,
  isQuestTurnInNpc,
  LEASH_DISTANCE,
  type LootEntry,
  type LootRollChoice,
  type LootRollPrompt,
  type LootSlot,
  type LootStrategies,
  MAX_LEVEL,
  MELEE_ARC,
  MELEE_RANGE,
  type MobFamily,
  type MoveInput,
  meleeMissChance,
  normAngle,
  NYTHRAXIS_ADD_ID,
  NYTHRAXIS_BOSS_ID,
  type OverheadEmoteId,
  PARTY_XP_RANGE,
  type PetMode,
  type PlayerClass,
  type QuestDef,
  type QuestProgress,
  type QuestState,
  questTurnInNpcIds,
  RUN_SPEED,
  type SimConfig,
  type SimEvent,
  type SkinCatalog,
  type SkinRank,
  spellHitChance,
  TURN_SPEED,
  type Vec3,
  virtualLevel,
  xpForLevel,
  xpToReachLevel,
} from './types';
import { groundHeight, WATER_LEVEL } from './world';

// TRIVIAL_LEVEL_GAP moved to mob/targeting.ts (used only by isTrivialTo).
// CORPSE_DURATION moved to combat/damage.ts (C1; used only by the death path).
// LEASH_DISTANCE / DUNGEON_LEASH_DISTANCE moved to types.ts (M2; shared with mob/locomotion.ts).
// EVADE_SPEED_MULT / EVADE_STALL_TIMEOUT moved to mob/locomotion.ts (M2; slice-only).
// Heading offsets (radians) a mob tries when its straight path is blocked, so it
// can slide around a prop instead of pinning on it. Desired heading (0) first;
// only evaluated past the first entry when that straight step is obstructed.
const MOVE_SLIDE_FAN = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6];
const BACKPEDAL_MULT = 0.65;
// Low-HP flee ("fear"): a cowardly mob at or below this HP fraction panics, turns
// and runs from its attacker for FLEE_DURATION seconds at FLEE_SPEED_MULT speed,
// calling same-family allies within FLEE_HELP_RADIUS to assist. It flees only once
// per pull, then recovers its nerve and re-engages if it survived.
const FLEE_HP_THRESHOLD = 0.2;
const FLEE_DURATION = 5;
const FLEE_SPEED_MULT = 1.4;
const FLEE_MAX_SPEED = RUN_SPEED;
// FLEE_RETURN_GRACE moved to mob/locomotion.ts (M2; used only by recoverFromFlee).
const FLEE_HELP_RADIUS = 8;
// Only sentient, cowardly families flee; beasts/undead/elementals/dragonkin fight
// to the death. Elites, rares, and bosses never flee regardless of family.
const FLEEING_FAMILIES: ReadonlySet<MobFamily> = new Set(['humanoid', 'kobold', 'murloc', 'troll']);
const GRAVITY = 16;
const JUMP_VELOCITY = 6; // apex = v^2/2g ≈ 1.125 yd
const FALL_SAFE_DISTANCE = 12; // yards of free fall before damage
const OBJECT_RESPAWN = 30;
const NYTHRAXIS_RELIC_SUMMONS: Record<string, string> = {
  captains_crest: 'fallen_captain_aldren',
  priests_sigil: 'corrupted_priest_malric',
  royal_seal: 'deathstalker_voss',
};
const _NYTHRAXIS_CRYPT_QUESTS = new Set(['q_nythraxis_sealed_crypt', 'q_nythraxis_bound_guardian']);
// NYTHRAXIS_BOSS_ID / NYTHRAXIS_ADD_ID moved to types.ts (M2; shared with mob/locomotion.ts;
// the dungeon raid-door seal in instances/dungeons.ts also reads NYTHRAXIS_BOSS_ID per I1).
const NYTHRAXIS_ALDRIC_ID = 'brother_aldric_raid';
const _NYTHRAXIS_FINAL_QUEST_ID = 'q_nythraxis_scourges_end';
const NYTHRAXIS_WARDSTONE_ITEM_ID = 'bastion_ward_stone';
// How far a wardstone may sit from the boss spawn and still belong to this
// encounter. The three arena wards form a wide forward triangle (~54yd out), so
// this must comfortably exceed that; far above any cross-instance false match.
const NYTHRAXIS_WARDSTONE_RANGE = 100;
const NYTHRAXIS_GRAVEBREAKER_EVERY = 12;
const NYTHRAXIS_GRAVEBREAKER_RANGE = 11;
const NYTHRAXIS_GRAVEBREAKER_HALF_ARC = Math.PI / 3;
const NYTHRAXIS_OPENER_SECOND_YELL_DELAY = 4;
const NYTHRAXIS_DIALOGUE_LINE_SECONDS = 2.6;
const NYTHRAXIS_RAISE_FALLEN_EVERY = 45;
const NYTHRAXIS_PHASE_TWO_HP = 0.7;
const NYTHRAXIS_SOUL_REND_EVERY = 30;
const NYTHRAXIS_SOUL_REND_DURATION = 8;
const NYTHRAXIS_SOUL_REND_STACK_RANGE = 5;
const NYTHRAXIS_DEATHLESS_EVERY = 45;
const NYTHRAXIS_DEATHLESS_CAST = 10;
const NYTHRAXIS_DEATHLESS_CHANNEL = 5;
const NYTHRAXIS_DEATHLESS_STUN = 5;
const NYTHRAXIS_DEATHLESS_SOUL_REND_LOCKOUT = 15;
const NYTHRAXIS_PHASE_TWO_SETTLE_DELAY = 5;
const NYTHRAXIS_LOCKOUT_MS = 24 * 60 * 60 * 1000;
const NYTHRAXIS_TRANSITION_DURATION = 21;
const NYTHRAXIS_TRANSITION_STUN = 21.5;
const NYTHRAXIS_FINAL_STAND_HP = 0.05;
const NYTHRAXIS_ROOM_RADIUS = 260;
// Brother Aldric enters on the door side of the arena (the raid's side, lower z
// than the boss spawn) and walks toward the boss. Distances are yards in front
// of the boss spawn: appears 50yd out, walks up to 30yd out (between door + boss).
const NYTHRAXIS_ALDRIC_SPAWN_DIST = 50;
const NYTHRAXIS_ALDRIC_WALK_DIST = 30;
// PARTY_MAX / RAID_MIN / RAID_MAX / RAID_GROUP_MAX moved to social/party.ts (A1),
// the only code that reads them.
// RAID_ALLOWED_DUNGEON_IDS / RAID_REQUIRED_DUNGEON_IDS moved to instances/dungeons.ts
// (I1: read only by enterDungeon's raid gate).
// DAMAGE_IDLE_DESPAWN_SECONDS / DAMAGE_IDLE_DESPAWN_MOB_IDS moved to entity_roster.ts
// (the despawn prologue's home); imported above for the damage-path timer reset.
// PARTY_XP_RANGE moved to types.ts (C1; used by the damage-core xp-split + M1 assist), imported above.
// Rested XP (classic inn-rested bonus). Resting inside an inn footprint accrues a
// pool that doubles KILL xp (200%) until spent — vanilla's signature casual-pacing
// lever. Vanilla rate is 5% of a level per 8 in-game hours, capped at 1.5 levels.
// The sim has no day/night clock, so "in-game hours" map to a fixed sim-seconds
// constant (determinism: accrual is keyed off sim time via DT, never wall-clock).
const RESTED_SECONDS_PER_GAME_HOUR = 60; // 1 in-game hour = 60 sim seconds
const RESTED_FILL_FRACTION = 0.05; // a full "bubble" = 5% of the level's XP-to-level
const RESTED_FILL_HOURS = 8; // accrued per this many in-game hours of resting
const RESTED_CAP_LEVELS = 1.5; // pool clamps to 1.5 levels of XP, as in vanilla
const RESTED_INN_PADDING = 2; // yards of slack around the inn footprint that still counts as resting
// A2: DUEL_COUNTDOWN/DUEL_FORFEIT_DISTANCE moved to social/duel.ts; the Ashen
// Coliseum 1v1 arena tuning (ARENA_COUNTDOWN/RETURN_DELAY/MAX_DURATION/BASE_RATING/
// MIN_RATING/K_FACTOR) + eloDelta moved to social/arena.ts (ARENA_BASE_RATING is
// imported back via arenaMod for the PlayerMeta ctor default).
const ARENA_LADDER_SIZE = 10; // live online standings shipped to clients
// A3: the 2v2 Fiesta tuning consts (score limit, augment waves, respawn growth,
// hazard ring, power-ups, standard level) moved to social/fiesta.ts with the match
// logic. FIESTA_RING_CX/CZ, FIESTA_TOTAL_WAVES, and FIESTA_POWERUP_TELEGRAPH/TTL are
// imported back (above) for the fiestaMatchInfo presentation accessor, which stays
// on Sim. (A2 already moved FIESTA_COUNTDOWN to social/arena.ts.)
const PVP_ROOT_DR_RESET = 18; // seconds before a repeated PvP root is fresh again
const PVP_POLYMORPH_DR_RESET = 60;
const PVP_FEAR_DR_RESET = 60;
const PVP_CC_DR_MULTIPLIERS = [1, 0.5, 0.25] as const;
const PVP_POLYMORPH_DR_DURATIONS = [10, 5, 1] as const;
const PVP_FEAR_DR_DURATIONS = [8, 4, 2, 1] as const;
const SAY_RANGE = 25; // /say carries a short distance; /yell across a camp
const YELL_RANGE = 100;
const OVERHEAD_EMOTE_DURATION = 3.2;

// Predefined social emotes. Each entry maps a command (and its aliases) to the
// third-person action text shown to everyone in /say range. `solo` is used with
// no target; `target` (when present) is used when the emote names another
// player and contains a `%t` placeholder for that player's name. The actor's
// own name is rendered separately by the client, so these strings start at the
// verb (e.g. "Aleph" + " waves.").
interface EmoteDef {
  solo: string;
  target?: string;
}
const EMOTES: Record<string, EmoteDef> = {
  wave: { solo: 'waves.', target: 'waves at %t.' },
  bow: { solo: 'bows.', target: 'bows before %t.' },
  cheer: { solo: 'cheers!', target: 'cheers at %t!' },
  dance: { solo: 'bursts into dance.', target: 'dances with %t.' },
  laugh: { solo: 'laughs.', target: 'laughs at %t.' },
  cry: { solo: 'cries.', target: "cries on %t's shoulder." },
  salute: { solo: 'salutes.', target: 'salutes %t.' },
  thank: { solo: 'thanks everyone.', target: 'thanks %t.' },
  clap: { solo: 'applauds. Bravo!', target: 'applauds %t. Bravo!' },
  greet: { solo: 'greets everyone with a hearty hello.', target: 'greets %t with a hearty hello.' },
  roar: { solo: 'lets out a mighty roar.', target: 'roars at %t.' },
  sigh: { solo: 'sighs.', target: 'sighs at %t.' },
  kneel: { solo: 'kneels down.', target: 'kneels before %t.' },
  point: { solo: 'points.', target: 'points at %t.' },
  flex: { solo: 'flexes.', target: 'flexes at %t.' },
  cower: { solo: 'cowers in fear.', target: 'cowers in fear at the sight of %t.' },
};
// Command aliases → canonical emote key above.
const EMOTE_ALIASES: Record<string, string> = {
  hi: 'greet',
  hello: 'greet',
  thanks: 'thank',
  applaud: 'clap',
};
// The auras a target carries that are working against it. Everything else
// (buff_*, hot, absorb, imbue, stances, forms, stealth, thorns, attackspeed
// haste) is treated as helpful/neutral. Used by /targetbuffs to tag each aura.
const HARMFUL_AURA_KINDS: ReadonlySet<AuraKind> = new Set<AuraKind>([
  'dot',
  'slow',
  'stun',
  'root',
  'incapacitate',
  'polymorph',
  'sunder',
  'spellvuln',
  'vulnerability',
  'tongues',
  'cost_tax',
  'critvuln',
]);

function isHarmfulAura(kind: AuraKind): boolean {
  return HARMFUL_AURA_KINDS.has(kind);
}
const NEARBY_RANGE = 40; // /nearby scan radius — wider than say, tighter than yell
const NEARBY_MAX = 10; // cap the /nearby list so a crowded camp can't spam chat
// /assist resolves a named player only if they are within interest range (you can see
// them) OR in your party/raid (you coordinate with them across the whole map). This
// mirrors the server's ~120yd snapshot scope so /assist never reaches a stranger on the
// far side of the world. Party/raid members are always included, regardless of distance.
const ASSIST_RANGE = 120;
const CHAT_BURST = 8; // messages a player may send back-to-back...
const CHAT_REFILL = 2; // ...then this many more per second (caps spam amplifiers)
// Max characters in a single chat line, matching classic WoW's 255-char editbox.
// Authoritative cap: enforced here in the deterministic core so every host agrees;
// the client maxlength + server chat-log slices mirror it.
export const MAX_CHAT_MESSAGE_LEN = 255;
// A2: DUEL_FORFEIT_DISTANCE moved to social/duel.ts.
const TRADE_RANGE = 10;
// The World Market (the Merchant's auction house)
const MARKET_RANGE = INTERACT_RANGE + 2; // you must stand at the Merchant to deal
const MARKET_MAX_LISTINGS = 12; // active player listings per seller
const MARKET_MIN_PRICE = 1; // copper
const MARKET_MAX_PRICE = 5_000_000; // 500g ceiling — guards against overflow / fat-finger
const MARKET_CUT = 0.05; // the Merchant's cut on a completed sale (a gold sink)
const MARKET_LISTING_DURATION = 48 * 3600; // sim-seconds an unsold listing lingers before returning
const MARKET_WIRE_LIMIT = 120; // most listings shipped to one client at a time
const VENDOR_BUYBACK_LIMIT = 12;
// INSTANCE_EMPTY_TIMEOUT relocated to types.ts (I1: shared with the delve reaper below);
// imported above.
// Delve run-lifecycle consts moved to src/sim/delves/runs.ts (I2a): the solid-prop
// radii (DELVE_CHEST/GRAVE/WALL_SOLID_R), DELVE_INTERACT_RANGE, DELVE_BAD_AIR_INTERVAL,
// DELVE_RAISE_DEAD_CHANNEL, DELVE_EXIT_PORTAL_RADIUS, DELVE_LORE_ORDER, and (re-exported
// below) DELVE_MODULE_NAMES + DELVE_IMPLEMENTED_AFFIXES. DELVE_PLATE_RADIUS +
// DELVE_COMPANION_MAX_RANK relocated to types.ts (shared with the I2b/I2c lockpick +
// companion code still on Sim). The companion (I2c) tuning consts stay here until I2c.
const DELVE_COMPANION_HEAL_RANGE = 22;
const DELVE_COMPANION_HEAL_INTERVAL = 3;
const DELVE_COMPANION_FOLLOW = 4;
// Tessa heals a PERCENT of the target's max HP each tick, indexed by rank (1-3), so
// her output stays relevant as player HP grows, the old flat `8 + rank*4` decayed to
// noise by level 9. Tuned (combat spec) so L7 Normal is sustainable, L7 Heroic is not
// savable by Tessa alone, and L9 Heroic is sustainable from rank 2.
const DELVE_COMPANION_HEAL_PCT = [0, 0.06, 0.08, 0.1];
// Tessa's combat level as a fraction of the owner's, indexed by rank (1-3): she
// arrives a junior aide and grows into a true peer as you invest Marks. Pairs with
// DELVE_COMPANION_HEAL_PCT so a rank-up lifts both her survivability and her healing.
const DELVE_COMPANION_LEVEL_PCT = [0, 0.5, 0.75, 1.0]; // index = rank
// DELVE_MODULE_NAMES + DELVE_IMPLEMENTED_AFFIXES now live in src/sim/delves/runs.ts;
// re-exported from there so external importers (src/ui/sim_i18n.ts, tests) are unchanged.
export { DELVE_IMPLEMENTED_AFFIXES, DELVE_MODULE_NAMES } from './delves/runs';
const MAX_CLIMB_SLOPE = PLAYER_MAX_CLIMB_SLOPE; // rise/run above which a ground move is blocked (cliffs, world rim)

// How far a mob pulls same-family neighbours into a fight ("social aggro").
// Murlocs (the clustered water mobs players call "frogs") used to pull too much,
// chain-aggroing the whole pond and making solo pulls impossible (#102). Tune
// per family here; everything else falls back to the default.
const POTION_COOLDOWN = 60; // seconds; shared cooldown across combat potions (#103)
const DEFAULT_SOCIAL_PULL_RADIUS = 5;
const SOCIAL_PULL_RADIUS: Partial<Record<MobFamily, number>> = {
  murloc: 8,
};
const PACK_FRENZY_AURA_ID = 'pack_frenzy'; // attack-speed buff granted to surviving packmates
const SWIM_SURFACE_Y = WATER_LEVEL - 0.75; // body bobs just below the water line
const SWIM_DEPTH = PLAYER_SWIM_DEPTH; // ground this far under the water line = deep water
const SWIM_SPEED_MULT = 0.65;
const FISHING_SAMPLE_DISTANCES = [4, 8, 12, 16, 20, 24];
const DEEPFEN_FISHING_SHORE_MARGIN = 10;
const THE_CODFATHER_ITEM_ID = 'the_codfather';
const THE_CODFATHER_QUEST_ID = 'q_the_codfather';
// DOOR_TRIGGER_RADIUS moved to instances/dungeons.ts (I1: read only by updateDoorTriggers).
const NYTHRAXIS_PARTY_INTERACT_RANGE = 30;
const NYTHRAXIS_VISION_LINE_DELAY = 5;
const BODY_RADIUS = PLAYER_BODY_RADIUS;
const CHARGE_SPEED_MULT = 3; // warrior charge runs at 3x normal speed
const CHARGE_MAX_DURATION = 3; // seconds before a blocked charge gives up
const CHARGE_ARRIVE_RANGE = MELEE_RANGE - 1; // stop inside melee range
const FOLLOW_STOP_DIST = 3; // /follow trails this close behind the leader (yards)
const FOLLOW_MAX_RANGE = 60; // give up follow once the leader is this far away
const PET_LEASH = 40; // yards from the owner before a pet gives up its target
const PET_FOLLOW_DISTANCE = 3.5;
const PET_TELEPORT_DISTANCE = 60; // owner this far AND no route exists: pet warps to heel (last resort)
const PET_PATH_RECALC = 0.5; // seconds between heel-path A* recomputes per pet (throttle)
const PET_PATH_SPAN = 96; // A* search half-window in cells; covers the teleport distance + slack
const PET_PATH_STALE_DISTANCE = 4; // path end this far from the (now-moved) owner: recompute the heel route
const PET_WAYPOINT_REACHED = 1; // pet within this of the next waypoint: pop it and home on the next leg
const PET_ASSIST_RANGE = 50; // how far the pet scans for enemies engaging the pair
const PET_AGGRESSIVE_RANGE = 18; // aggressive pets look for idle enemies this close
// Anti-AFK: an aggressive pet only proactively pulls fresh targets while its
// owner has acted (moved, cast, or commanded the pet) within this many ticks.
// 1200 ticks = 60s at 20Hz. Stops hunters/warlocks parking an aggressive pet to
// farm XP/loot while AFK; the pet still DEFENDS an idle owner. Tunable.
const PET_OWNER_IDLE_TICKS = 1200;
// A pet only keeps its OWNER flagged in combat while it is actively trading blows
// (its combatTimer resets to 0 on every hit dealt/taken). A pet that merely holds a
// target it is chasing or can't reach stops dragging the owner into perpetual combat
// past this window, so the owner's out-of-combat health regen resumes. Matches the
// 5s combat-linger used for the owner's own inCombat flag.
const PET_COMBAT_LINGER = 5;
const PET_TAUNT_RANGE = 5;
const PET_GROWL_INTERVAL = 10; // controlled pets can tank by forcing attention
const PET_FEED_DURATION = 5;
const PET_FEED_TICK = 1;
const DEMON_HEAL_MANA_COST = 55;
const DEMON_HEAL_DURATION = 5;
const DEMON_HEAL_TICK = 1;
const TAMED_TARGET_RESPAWN_SECONDS = 60;
const LOOT_ROLL_TIMEOUT = 30;

export interface Party {
  id: number;
  leader: number; // pid
  members: number[]; // pids
  raid: boolean;
  raidGroups: Map<number, 1 | 2>; // pid -> raid subgroup
  lootStrategies: LootStrategies;
}

interface PendingLootRoll {
  id: number;
  mobId: number;
  itemId: string;
  itemName: string;
  quality: ItemDef['quality'];
  candidates: number[];
  choices: Map<number, { choice: LootRollChoice; roll: number | null }>;
  expiresAt: number;
}

export interface TradeSession {
  a: number;
  b: number;
  offerA: { items: InvSlot[]; copper: number };
  offerB: { items: InvSlot[]; copper: number };
  acceptedA: boolean;
  acceptedB: boolean;
}

export interface DuelState {
  a: number;
  b: number;
  state: 'countdown' | 'active';
  timer: number; // countdown remaining / elapsed
}

// GroundAoE type moved to entity_roster.ts (the ground-AoE drain's home); imported above.

export type { ArenaFormat } from './types';

export interface ArenaQueueUnit {
  pids: number[]; // length 1 (solo) or 2 (premade)
  rating: number; // avg member rating for this queue's bracket
}

// A live arena bout. Combatants are teleported into a private arena instance
// slot; `returns` remembers where each was standing so the match can put them
// back when it ends. Ratings are snapshotted at the start purely for the
// result message — the authoritative values live on each PlayerMeta.
export interface ArenaMatch {
  id: number;
  format: ArenaFormat;
  teamA: number[];
  teamB: number[];
  slot: number; // arena instance slot
  state: 'countdown' | 'active' | 'over';
  timer: number; // countdown remaining, then elapsed once active, then return countdown
  returns: Map<number, { x: number; z: number; facing: number }>;
  ratingA: number; // team avg at start
  ratingB: number;
  defeated: Set<number>;
  fiesta?: FiestaState; // present only for format === 'fiesta'
}

// Everything that makes a Fiesta bout a fiesta. Lives on the ArenaMatch so it is
// torn down with the match. Deterministic throughout: augment offers draw from
// `rng` (seeded from the sim stream at match start) so a replay re-offers the
// same cards.
export interface FiestaState {
  scoreA: number;
  scoreB: number;
  scoreLimit: number;
  wave: number; // 0 before the first wave opens, then 1..FIESTA_TOTAL_WAVES
  nextWaveAt: number; // active-timer value (s) at which the next wave opens
  // Pending augment offers, by pid — the three cards a fighter has yet to pick.
  offers: Map<number, { tier: AugmentTier; wave: number; choices: string[] }>;
  ringRadius: number; // current hazard-ring radius (instance-local)
  ringTarget: number; // radius it is easing toward
  respawn: Map<number, number>; // pid -> seconds until revive (absent = alive)
  deaths: Map<number, number>; // pid -> times downed (drives respawn growth)
  kills: Map<number, number>; // pid -> takedowns this bout (scoreboard)
  streak: Map<number, number>; // pid -> takedowns since last death (word pops)
  lastKill: Map<number, number>; // pid -> active-timer of last takedown (double-kill window)
  // Augment offers wait here until the player's NEXT death so a pick never
  // interrupts a live fight (pid -> queued offers, oldest first).
  pending: Map<number, { tier: AugmentTier; wave: number; choices: string[] }[]>;
  powerups: FiestaPowerup[];
  nextPowerupId: number;
  powerupTimer: number; // s until the next power-up spawn attempt
  firstBlood: boolean;
  rng: Rng;
}

// A ring power-up: telegraphs for FIESTA_POWERUP_TELEGRAPH seconds ('spawning'),
// then becomes grabbable ('ready') until it times out.
export interface FiestaPowerup {
  id: number;
  defId: string;
  x: number;
  z: number;
  state: 'spawning' | 'ready';
  timer: number; // spawning: countdown to ready; ready: countdown to despawn
}

// A2: eloDelta (with ARENA_K_FACTOR) moved to social/arena.ts; re-exported from the
// import block above so `import { Sim, eloDelta } from './sim'` is preserved.

export interface InstanceSlot {
  dungeonId: string;
  slot: number;
  partyKey: string | null; // party id or 'solo:<pid>'
  mobIds: number[];
  objectIds: number[];
  exitId: number | null;
  emptyFor: number;
}

export interface ResolvedAbility {
  def: AbilityDef;
  rank: number;
  cost: number;
  castTime: number;
  cooldown: number; // base def.cooldown, after talent cooldown modifiers
  effects: AbilityEffect[];
  threatFlat: number; // classic bonus threat on a successful use
  threatMult: number; // classic multiplier on this ability's damage-threat
}

export interface RewardCounters {
  damageDealt: number;
  damageTaken: number;
  kills: number;
  deaths: number;
  xpGained: number;
  questsCompleted: number;
  questProgress: number;
  lootCopper: number;
  levelUps: number;
}

export interface SentChat {
  channel: 'say' | 'yell' | 'whisper' | 'general' | 'party' | 'world' | 'lfg';
  message: string;
  target?: string;
}

export interface SkinClaimResult {
  catalog: SkinCatalog;
  skin: number;
  chromaId?: string;
}

export interface ItemUseResult {
  type: 'mechChroma';
  chromaId: string;
}

// Opt-in global chat channels a player can /join and /leave. `general` is
// always-on (everyone hears /general), so it is intentionally not joinable here.
export const JOINABLE_CHANNELS = ['world', 'lfg'] as const;
export type JoinableChannel = (typeof JOINABLE_CHANNELS)[number];

// Per-player progression and bags. The entity holds combat state; this holds
// everything that belongs to the character sheet.
export interface PlayerMeta {
  entityId: number;
  // Stable database character id when running on the server. Offline/sim-only
  // callers fall back to entityId for systems that need a rename-proof owner key.
  characterId?: number;
  cls: PlayerClass;
  name: string;
  skin: number; // appearance index into the render SKINS[player_<cls>]; persisted, synced
  skinCatalog: SkinCatalog;
  // Cosmetic skin-select event: the rank rolled when the event token was used,
  // pending a lock-in. Set on use, cleared on claim. Persisted so the reward
  // survives reconnect; re-using the token re-shows the same rank (no reroll).
  pendingSkinRank: SkinRank | null;
  pendingSkinCatalog: SkinCatalog | null;
  pendingSkinItemId: string | null;
  moveInput: MoveInput;
  inventory: InvSlot[];
  vendorBuyback: InvSlot[];
  copper: number;
  equipment: PlayerEquipment;
  xp: number;
  // Post-cap progression (Max-Level XP Overflow). `lifetimeXp` is the monotonic
  // 64-bit-safe total of all XP ever earned — it keeps growing at the cap and is
  // the leaderboard sort key + virtual-level source. `prestigeRank` and
  // `unlockedMilestones` are cosmetic-only. All persisted in CharacterState.
  lifetimeXp: number;
  prestigeRank: number;
  unlockedMilestones: Set<string>;
  // Classic Rested XP pool (copper-less XP units). Accrues while resting in an
  // inn, spent to double kill XP. Persisted in CharacterState.
  restedXp: number;
  known: ResolvedAbility[];
  questLog: Map<string, QuestProgress>;
  questsDone: Set<string>;
  counters: RewardCounters;
  autoEquip: boolean;
  // sim.time when this character entered the world; powers /played. Session-only
  // (sim.time resets to 0 each server boot), so it reports time this session.
  joinedAt: number;
  // Tick of the player's last deliberate action (movement, ability cast, or pet
  // command). Session-only, never persisted. Powers the anti-AFK gate on
  // aggressive pet auto-pull (see PET_OWNER_IDLE_TICKS) so an idle owner's pet
  // cannot farm the area alone.
  lastActiveTick: number;
  // Ashen Coliseum standings. Legacy arenaRating/Wins/Losses are the 1v1
  // bracket; 2v2 is fully independent and persisted alongside them.
  arenaRating: number;
  arenaWins: number;
  arenaLosses: number;
  arena2v2Rating: number;
  arena2v2Wins: number;
  arena2v2Losses: number;
  // Talents & Specializations. `talents` is the active allocation; `talentMods`
  // is its precomputed flat struct — resolved only on allocation/respec/loadout
  // change (recomputeTalents), never walked on the combat or stat hot path.
  talents: TalentAllocation;
  talentMods: TalentModifiers;
  // 2v2 Fiesta (session-only, never persisted). `fiestaAugments` is the ordered
  // list of augment ids picked this bout; `fiestaMods` is talentMods with those
  // augments folded in (the effective modifier the stat/ability hot paths use
  // while in a Fiesta match); `fiestaSpecial` aggregates the non-modifier augment
  // effects (lifesteal, move speed). All cleared when the bout ends.
  fiestaAugments: string[];
  fiestaMods: TalentModifiers | null;
  fiestaSpecial: AugmentSpecial;
  // Pre-Fiesta character snapshot while standardized to level 20 (see
  // fiestaStandardize); restored on bout exit and used by serializeCharacter so
  // the temporary level-20 build is never persisted.
  fiestaRestore: { level: number; xp: number; talents: TalentAllocation } | null;
  loadouts: SavedLoadout[];
  activeLoadout: number; // index into loadouts, or -1 for none
  raidLockouts: Map<string, number>; // dungeon id -> epoch ms expiry
  // Transient presence status. Set by /afk and /dnd, cleared when the player
  // chats again. Session-only — never persisted, so it resets on login.
  away: AwayStatus | null;
  // Session-only: name of the last player who whispered us, for "/r" replies.
  // Never persisted — a fresh login starts with no reply target.
  lastWhisperFrom?: string;
  // Session-only World Market browse filter. The market is capped at
  // MARKET_WIRE_LIMIT listings per snapshot to bound wire cost, so this
  // server-side substring filter (matched against item names) is how a player
  // reaches goods past the cap. Never persisted — resets on login.
  marketFilter: string;
  // Delve meta progression (persisted in CharacterState).
  delveMarks: number;
  delveClears: Record<string, number>;
  companionUpgrades: Record<string, number>;
  delveLoreUnlocked: Set<string>;
  delveDaily: { date: string; firstClearXp: Set<string>; markClears: number };
}

// Away-from-keyboard / do-not-disturb presence. `afk` still delivers whispers
// (the sender just gets a heads-up); `dnd` withholds them.
export interface AwayStatus {
  mode: 'afk' | 'dnd';
  message: string;
}

// ---------------------------------------------------------------------------
// The World Market — a single shared, server-authoritative auction house run
// by the Merchant NPC. Listings live in the sim (so offline play has a market
// too and the rules are testable); the server persists them to Postgres.
// Sellers are keyed by stable character id where available, so proceeds and
// returns still reach the right player after a character rename.
// ---------------------------------------------------------------------------

export interface MarketListing {
  id: number;
  sellerKey: string; // stable seller identity (character id string); '' for house stock
  sellerName: string; // display name
  itemId: string;
  count: number;
  price: number; // total copper buyout for the whole stack
  expiresAt: number; // sim.time seconds; Infinity for the Merchant's own stock
  house: boolean; // the Merchant's standing stock: never expires, never depletes, pays no one
}

// Gold + items awaiting pickup at the Merchant (sale proceeds, expired
// listings), keyed by sellerKey so an offline seller can collect later.
export interface MarketCollection {
  copper: number;
  items: InvSlot[];
}

// Persistable market state. `secondsLeft` is stored instead of an absolute
// expiry because sim.time resets to 0 each server boot — on load it becomes
// `this.time + secondsLeft`, so a restart never silently expires everything.
export interface MarketSave {
  listings: {
    id: number;
    sellerKey: string;
    sellerName: string;
    itemId: string;
    count: number;
    price: number;
    secondsLeft: number;
  }[];
  collections: { key: string; copper: number; items: InvSlot[] }[];
  nextListingId: number;
}

// Persistable character state (stored as JSONB server-side). The arena fields
// are optional so characters saved before the Ashen Coliseum existed load
// cleanly (addPlayer falls back to the unranked defaults).
export interface CharacterState {
  level: number;
  xp: number;
  // Post-cap progression. All optional so characters saved before the Max-Level
  // XP Overflow system load cleanly (addPlayer backfills lifetimeXp from level).
  lifetimeXp?: number;
  prestigeRank?: number;
  unlockedMilestones?: string[];
  // Rested XP pool. Optional so pre-rested-XP saves load cleanly (defaults to 0).
  restedXp?: number;
  copper: number;
  hp: number;
  resource: number;
  pos: { x: number; z: number };
  facing: number;
  equipment: PlayerEquipment;
  inventory: InvSlot[];
  vendorBuyback?: InvSlot[];
  questLog: { questId: string; counts: number[]; state: 'active' | 'ready' | 'done' }[];
  questsDone: string[];
  // Legacy arenaRating/Wins/Losses are treated as 1v1 data. The explicit
  // 1v1 fields are written by new saves, while old saves fall back cleanly.
  arenaRating?: number;
  arenaWins?: number;
  arenaLosses?: number;
  arena1v1Rating?: number;
  arena1v1Wins?: number;
  arena1v1Losses?: number;
  arena2v2Rating?: number;
  arena2v2Wins?: number;
  arena2v2Losses?: number;
  // Talents & Specializations (JSONB; no schema migration). All optional so
  // characters saved before talents existed load cleanly (default: no points spent).
  talents?: TalentAllocation;
  loadouts?: SavedLoadout[];
  activeLoadout?: number;
  raidLockouts?: Record<string, number>;
  pet?: PetState | null;
  skin?: number; // appearance index (JSONB; optional so pre-skin saves load as 0)
  skinCatalog?: SkinCatalog;
  // Pending skin-select event rank (JSONB; optional so older saves load as null).
  pendingSkinRank?: SkinRank | null;
  pendingSkinCatalog?: SkinCatalog | null;
  pendingSkinItemId?: string | null;
  delveMarks?: number;
  delveClears?: Record<string, number>;
  companionUpgrades?: Record<string, number>;
  delveLoreUnlocked?: string[];
  delveDaily?: { date: string; firstClearXp: string[]; markClears: number };
}

export interface PetState {
  templateId: string;
  name: string;
  level: number;
  hp: number;
  dead: boolean;
  mode?: PetMode;
  autoTaunt?: boolean;
}

const PET_NAME_RE = /^[A-Za-z][A-Za-z '-]{1,15}$/;

interface PendingMobRespawn {
  templateId: string;
  level: number;
  pos: Vec3;
  facing: number;
  dungeonId: string | null;
  timer: number;
}

// Pure quest-state computation, shared by the sim and the network client.
export function computeQuestState(
  questId: string,
  questLog: Map<string, QuestProgress>,
  questsDone: Set<string>,
  playerLevel: number,
): QuestState {
  if (questsDone.has(questId)) return 'done';
  const qp = questLog.get(questId);
  if (qp) return qp.state === 'ready' ? 'ready' : 'active';
  const quest = QUESTS[questId];
  if (!quest) return 'unavailable';
  if (quest.requiresQuest && !questsDone.has(quest.requiresQuest)) return 'unavailable';
  if (quest.minLevel && playerLevel < quest.minLevel) return 'unavailable';
  if (quest.retired) return 'unavailable';
  return 'available';
}

// copyPos moved to entity_roster.ts (used only by the despawn prologue).

function freshCounters(): RewardCounters {
  return {
    damageDealt: 0,
    damageTaken: 0,
    kills: 0,
    deaths: 0,
    xpGained: 0,
    questsCompleted: 0,
    questProgress: 0,
    lootCopper: 0,
    levelUps: 0,
  };
}

function isStealthToggle(ability: AbilityDef): boolean {
  return ability.effects.some((e) => e.type === 'selfBuff' && e.kind === 'stealth');
}

function preservesStealth(ability: AbilityDef): boolean {
  return isStealthToggle(ability) || ability.id === 'sprint';
}

function isPetClass(cls: PlayerClass): boolean {
  return cls === 'hunter' || cls === 'warlock';
}

export class Sim {
  cfg: Required<Omit<SimConfig, 'noPlayer'>>;
  rng: Rng;
  time = 0;
  tickCount = 0;
  entities = new Map<number, Entity>();
  // The shared SimContext seam (S0b): a live view of rng/time/tickCount/entities +
  // emit, plus the cross-system callbacks the extracted game-system slices route
  // through instead of reaching into Sim. Built once in the ctor (buildSimContext);
  // it moves no behavior. See src/sim/sim_context.ts.
  readonly ctx: SimContext;
  // Party/raid state machine (A1): owns parties/partyByPid/partyInvites/nextPartyId
  // and the invite/accept/convert/move/leave/kick/disband logic, moved off Sim
  // behind SimContext. Built in the ctor after `ctx`. Sim keeps thin delegates
  // (partyOf + the eight command methods) so IWorld + foreign call sites resolve.
  private party!: PartyMachine;
  players = new Map<number, PlayerMeta>(); // keyed by entity id
  // spatial indexes for radius queries; re-bucketed at the end of each tick
  // and kept roster-exact on spawn/despawn/teleport
  readonly grid = new SpatialGrid();
  readonly playerGrid = new SpatialGrid();
  private engagedPids = new Set<number>();
  primaryId = -1; // the local/RL player in single-player contexts
  nextId = 1;
  events: SimEvent[] = [];
  // Owned by E1 (entity_roster drains it); stays on Sim because N1/M3 schedule into
  // it. Exposed as a live view via SimContext.
  private delayedEvents: DelayedEvent[] = [];
  // social systems
  // parties / partyByPid / partyInvites / nextPartyId moved to the PartyMachine
  // (src/sim/social/party.ts, session A1); reached via `this.party`.
  accountCosmetics: AccountCosmetics = { completedQuestIds: [], mechChromaIds: [] };
  private nextLootRollId = 1;
  private pendingLootRolls = new Map<number, PendingLootRoll>();
  // raid/target markers: partyId -> (enemy entityId -> markerId 0..7). A
  // cosmetic, party-scoped overlay — never read by tick()/obs/persistence.
  partyMarkers = new Map<number, Map<number, number>>();
  trades = new Map<number, TradeSession>(); // pid -> shared session (both pids point at it)
  tradeInvites = new Map<number, { fromPid: number; expires: number }>();
  duels = new Map<number, DuelState>(); // pid -> shared duel (both pids)
  duelInvites = new Map<number, { fromPid: number; expires: number }>();
  // arena: format-specific queues, live bouts keyed by every participant pid,
  // and the set of busy instance slots
  arenaQueue1v1: number[] = [];
  arenaQueue2v2: ArenaQueueUnit[] = [];
  arenaQueueFiesta: ArenaQueueUnit[] = []; // 2v2 Fiesta (party mode) queue
  arenaMatches = new Map<number, ArenaMatch>(); // pid -> shared match (both pids)
  private arenaBusySlots = new Set<number>();
  private nextArenaMatchId = 1;
  // per-player chat token bucket (anti-spam); refilled lazily by sim time
  private chatTokens = new Map<number, { tokens: number; at: number }>();
  // per-player set of opt-in global channels (world, lfg) joined via /join
  private channelSubs = new Map<number, Set<JoinableChannel>>();
  // dungeon instances
  instances: InstanceSlot[] = [];
  // delve instances (separate slot pool from dungeons)
  delveRuns: DelveRun[] = [];
  private delvePetStash = new Map<number, PetState>();
  // Real-world UTC day ('YYYY-MM-DD') for the delve daily reset (FR-5.1). The sim
  // core must stay deterministic, so it never reads the wall clock itself: the host
  // (server/offline client) sets this each tick from `new Date()`. Empty string =
  // "no calendar known" (headless/replay), the daily window then never rolls over,
  // keeping same-seed runs reproducible. Tests may set it to pin a date.
  utcDay = '';
  // the World Market: one shared listing book, per-seller collections keyed by
  // stable character identity, and the Merchant entity these are anchored to
  marketListings: MarketListing[] = [];
  private marketCollections = new Map<string, MarketCollection>();
  private nextListingId = 1;
  private merchantId = -1;
  /** When true, /dev level|tp|give chat commands are accepted (local dev only). */
  readonly devCommands: boolean;
  private pendingMobRespawns: PendingMobRespawn[] = [];
  private groundAoEs: GroundAoE[] = [];

  constructor(cfg: SimConfig) {
    this.devCommands = cfg.devCommands ?? false;
    this.cfg = {
      seed: cfg.seed,
      playerClass: cfg.playerClass,
      respawnSeconds: cfg.respawnSeconds ?? 25,
      autoEquip: cfg.autoEquip ?? false,
      playerName: cfg.playerName ?? 'Adventurer',
      devCommands: this.devCommands,
      lockoutNowMs: cfg.lockoutNowMs ?? (() => Math.floor(this.time * 1000)),
    };
    this.rng = new Rng(cfg.seed);
    // S0b seam: the shared SimContext every extracted slice routes through. Built
    // once here (the rng now exists); a live view + bound callbacks, it draws no rng
    // and mutates nothing, so it cannot perturb the construction draws below.
    this.ctx = this.buildSimContext();
    // Party/raid machine (A1): constructed after ctx (it consumes the seam). The
    // ctx party callbacks are lazy arrows, so this assignment before any tick/command
    // is what they resolve against; nothing below this point draws on the machine
    // during construction.
    this.party = new PartyMachine(this.ctx);

    // NPCs — nudged out of buildings and deep water if their data position is bad
    for (const npcDef of Object.values(NPCS)) {
      if (npcDef.dynamic) continue; // spawned on demand by its owning system, not surface-placed
      const safe = this.findSafePos(npcDef.pos.x, npcDef.pos.z, WATER_LEVEL + 0.6);
      const npc = createNpc(this.nextId++, npcDef, this.groundPos(safe.x, safe.z));
      this.addEntity(npc);
      if (npcDef.market) this.merchantId = npc.id; // the World Market is anchored here
    }
    this.seedHouseListings();

    // Mobs from camps
    for (const camp of CAMPS) {
      const template = MOBS[camp.mobId];
      // Aquatic/flagged swimmers may wade in the shallows; everyone else
      // still spawns on dry land even though combat movement can enter water.
      const minHeight = this.mobCanSpawnInWater(template) ? WATER_LEVEL - 0.5 : WATER_LEVEL + 0.4;
      for (let i = 0; i < camp.count; i++) {
        const ang = this.rng.range(0, Math.PI * 2);
        const r = Math.sqrt(this.rng.next()) * camp.radius;
        const safe = this.findSafePos(
          camp.center.x + Math.sin(ang) * r,
          camp.center.z + Math.cos(ang) * r,
          minHeight,
        );
        const pos = this.groundPos(safe.x, safe.z);
        const level = this.rng.int(template.minLevel, template.maxLevel);
        const mob = createMob(this.nextId++, template, level, pos);
        mob.facing = this.rng.range(-Math.PI, Math.PI);
        mob.prevFacing = mob.facing;
        mob.wanderTimer = this.rng.range(2, 10);
        this.addEntity(mob);
      }
    }

    // Ground objects
    for (const objDef of GROUND_OBJECTS) {
      for (const p of objDef.positions) {
        const obj = createGroundObject(
          this.nextId++,
          objDef.itemId,
          objDef.name,
          this.groundPos(p.x, p.z),
        );
        this.addEntity(obj);
      }
    }

    // Dungeon entrances + their private instance slots
    for (const dungeon of DUNGEON_LIST) {
      if (dungeon.overworldDoor === false) {
        for (let i = 0; i < INSTANCE_SLOT_COUNT; i++) {
          this.instances.push({
            dungeonId: dungeon.id,
            slot: i,
            partyKey: null,
            mobIds: [],
            objectIds: [],
            exitId: null,
            emptyFor: 0,
          });
        }
        continue;
      }
      const doorName = dungeon.id === 'nythraxis_crypt' ? 'Abandoned Crypt' : dungeon.name;
      const door = createGroundObject(
        this.nextId++,
        '',
        doorName,
        this.groundPos(dungeon.doorPos.x, dungeon.doorPos.z),
      );
      door.templateId = 'dungeon_door';
      door.dungeonId = dungeon.id;
      door.objectItemId = null;
      door.lootable = true; // interactable
      this.addEntity(door);
      for (let i = 0; i < INSTANCE_SLOT_COUNT; i++) {
        this.instances.push({
          dungeonId: dungeon.id,
          slot: i,
          partyKey: null,
          mobIds: [],
          objectIds: [],
          exitId: null,
          emptyFor: 0,
        });
      }
    }

    for (const delve of DELVE_LIST) {
      for (let i = 0; i < DELVE_SLOT_COUNT; i++) {
        const origin = delveOrigin(delve.index, i);
        this.delveRuns.push({
          delveId: delve.id,
          slot: i,
          partyKey: null,
          seed: 0,
          tierId: 'normal',
          affixes: [],
          modules: [],
          moduleIndex: 0,
          origin: { x: origin.x, z: origin.z },
          mobIds: [],
          objectIds: [],
          objective: { kind: delve.objective, counts: [0], complete: false },
          completed: false,
          emptyFor: 0,
          deathsThisRun: {},
          objectState: {},
          raiseDeadChannel: null,
          restlessPending: [],
          badAirTimer: 0,
          companionBarks: [],
          exitPortalOpen: false,
          bountiful: false,
          rewardChestId: null,
          surfaceExitId: null,
          lockpick: null,
        });
      }
    }

    if (!cfg.noPlayer) {
      this.addPlayer(this.cfg.playerClass, this.cfg.playerName, { autoEquip: this.cfg.autoEquip });
    }
  }

  private lockoutNowMs(): number {
    return this.cfg.lockoutNowMs?.() ?? Math.floor(this.time * 1000);
  }

  // -------------------------------------------------------------------------
  // Entity roster: every add/remove/teleport goes through these so the
  // spatial indexes always match the entities map
  // -------------------------------------------------------------------------

  // Roster ops live in entity_roster.ts (E1). These thin delegates keep the public
  // surface (`sim.addEntity`/`sim.rebucket`) and every internal `this.addEntity` /
  // `this.dropEntity` / `this.rebucket` call site resolving unchanged through the seam.
  addEntity(e: Entity): void {
    addEntityToRoster(this.ctx, e);
  }

  private dropEntity(id: number): void {
    dropEntityFromRoster(this.ctx, id);
  }

  rebucket(e: Entity): void {
    rebucketEntity(this.ctx, e);
  }

  private updatePendingMobRespawns(): void {
    if (this.pendingMobRespawns.length === 0) return;
    for (let i = this.pendingMobRespawns.length - 1; i >= 0; i--) {
      const pending = this.pendingMobRespawns[i];
      pending.timer -= DT;
      if (pending.timer > 0) continue;
      const template = MOBS[pending.templateId];
      if (template) {
        const mob = createMob(this.nextId++, template, pending.level, { ...pending.pos });
        mob.facing = pending.facing;
        mob.prevFacing = pending.facing;
        mob.dungeonId = pending.dungeonId;
        this.addEntity(mob);
      }
      this.pendingMobRespawns.splice(i, 1);
    }
  }

  // -------------------------------------------------------------------------
  // Players: join / leave / persistence
  // -------------------------------------------------------------------------

  addPlayer(
    cls: PlayerClass,
    name: string,
    opts?: { autoEquip?: boolean; state?: CharacterState; characterId?: number },
  ): number {
    const savedState = opts?.state ? sanitizeRemovedZone1Content(opts.state).state : undefined;
    // Characters saved inside a dungeon instance rejoin at its entrance —
    // their old instance is gone (or belongs to someone else) by now.
    let savedPos = savedState?.pos ?? null;
    // Delve must be checked BEFORE the dungeon branch: dungeonAt() returns null
    // for any x >= ARENA_X_MIN (which includes the delve band), so the dungeon
    // branch's `?? DUNGEON_LIST[0]` fallback would otherwise swallow a delve
    // position and eject the player to a dungeon door instead of the board door
    // (FR-1.6). The two bands are disjoint, so `else if` keeps dungeon handling intact.
    if (savedPos && isDelvePos(savedPos.x)) {
      const delve = delveAt(savedPos.x) ?? DELVE_LIST[0];
      savedPos = { x: delve.doorPos.x, z: delve.doorPos.z - 4 };
    } else if (savedPos && savedPos.x > DUNGEON_X_THRESHOLD) {
      const dungeon = dungeonAt(savedPos.x) ?? DUNGEON_LIST[0];
      savedPos = { x: dungeon.doorPos.x, z: dungeon.doorPos.z - 4 };
    }
    const startPos = savedPos
      ? this.groundPos(savedPos.x, savedPos.z)
      : this.groundPos(PLAYER_START.x, PLAYER_START.z);
    const savedArena1v1: ArenaStanding = {
      rating: savedState?.arena1v1Rating ?? savedState?.arenaRating ?? arenaMod.ARENA_BASE_RATING,
      wins: savedState?.arena1v1Wins ?? savedState?.arenaWins ?? 0,
      losses: savedState?.arena1v1Losses ?? savedState?.arenaLosses ?? 0,
    };
    const savedArena2v2: ArenaStanding = {
      rating: savedState?.arena2v2Rating ?? arenaMod.ARENA_BASE_RATING,
      wins: savedState?.arena2v2Wins ?? 0,
      losses: savedState?.arena2v2Losses ?? 0,
    };
    const player = createPlayer(this.nextId++, cls, startPos, name);
    this.addEntity(player);
    const classDef = CLASSES[cls];
    const meta: PlayerMeta = {
      entityId: player.id,
      characterId: opts?.characterId,
      cls,
      name,
      skin: savedState?.skin ?? 0,
      skinCatalog: savedState?.skinCatalog === 'mech' ? 'mech' : 'class',
      pendingSkinRank: savedState?.pendingSkinRank ?? null,
      pendingSkinCatalog: savedState?.pendingSkinCatalog ?? null,
      pendingSkinItemId: savedState?.pendingSkinItemId ?? null,
      moveInput: emptyMoveInput(),
      inventory: [],
      vendorBuyback: [],
      copper: 0,
      equipment: { mainhand: classDef.startWeapon, chest: classDef.startChest },
      xp: 0,
      lifetimeXp: 0,
      prestigeRank: 0,
      unlockedMilestones: new Set(),
      restedXp: 0,
      known: [],
      questLog: new Map(),
      questsDone: new Set(),
      counters: freshCounters(),
      autoEquip: opts?.autoEquip ?? false,
      joinedAt: this.time,
      lastActiveTick: this.tickCount,
      arenaRating: savedArena1v1.rating,
      arenaWins: savedArena1v1.wins,
      arenaLosses: savedArena1v1.losses,
      arena2v2Rating: savedArena2v2.rating,
      arena2v2Wins: savedArena2v2.wins,
      arena2v2Losses: savedArena2v2.losses,
      talents: emptyAllocation(),
      talentMods: emptyModifiers(),
      fiestaAugments: [],
      fiestaMods: null,
      fiestaSpecial: {},
      fiestaRestore: null,
      loadouts: [],
      activeLoadout: -1,
      raidLockouts: new Map(),
      away: null,
      marketFilter: '',
      delveMarks: 0,
      delveClears: {},
      companionUpgrades: {},
      delveLoreUnlocked: new Set(),
      delveDaily: { date: '', firstClearXp: new Set(), markClears: 0 },
    };
    this.players.set(player.id, meta);
    player.skinCatalog = meta.skinCatalog;
    player.skin = meta.skin; // mirror onto the entity so the renderer + wire can read it
    if (this.primaryId === -1) this.primaryId = player.id;

    if (savedState) {
      const s = savedState;
      player.level = Math.max(1, Math.min(MAX_LEVEL, s.level));
      player.facing = s.facing;
      player.prevFacing = s.facing;
      meta.xp = s.xp;
      // Backfill lifetimeXp for pre-overflow saves from the level they reached
      // plus their current bar progress, so the leaderboard is meaningful for
      // existing characters from day one.
      meta.lifetimeXp = s.lifetimeXp ?? xpToReachLevel(player.level) + Math.max(0, s.xp);
      meta.prestigeRank = s.prestigeRank ?? 0;
      meta.restedXp = Math.max(0, s.restedXp ?? 0);
      if (s.unlockedMilestones)
        for (const id of s.unlockedMilestones) meta.unlockedMilestones.add(id);
      meta.copper = s.copper;
      meta.equipment = { ...s.equipment };
      meta.inventory = s.inventory.map((i) => ({ ...i }));
      meta.vendorBuyback = (s.vendorBuyback ?? []).map((i) => ({ ...i }));
      for (const q of s.questLog) {
        if (q.state !== 'done')
          meta.questLog.set(q.questId, {
            questId: q.questId,
            counts: [...q.counts],
            state: q.state,
          });
      }
      for (const q of s.questsDone) meta.questsDone.add(q);
      if (s.talents)
        meta.talents = {
          spec: s.talents.spec ?? null,
          ranks: { ...s.talents.ranks },
          choices: { ...s.talents.choices },
        };
      if (s.loadouts)
        meta.loadouts = s.loadouts.map((l) => ({
          name: l.name,
          alloc: cloneAllocation(l.alloc),
          bar: [...(l.bar ?? [])],
        }));
      if (typeof s.activeLoadout === 'number') meta.activeLoadout = s.activeLoadout;
      if (s.raidLockouts) {
        const now = this.lockoutNowMs();
        for (const [dungeonId, until] of Object.entries(s.raidLockouts)) {
          if (Number.isFinite(until) && until > now) meta.raidLockouts.set(dungeonId, until);
        }
      }
      meta.delveMarks = s.delveMarks ?? 0;
      meta.delveClears = { ...(s.delveClears ?? {}) };
      meta.companionUpgrades = { ...(s.companionUpgrades ?? {}) };
      if (s.delveLoreUnlocked) for (const id of s.delveLoreUnlocked) meta.delveLoreUnlocked.add(id);
      if (s.delveDaily) {
        meta.delveDaily = {
          date: s.delveDaily.date,
          firstClearXp: new Set(s.delveDaily.firstClearXp),
          markClears: s.delveDaily.markClears,
        };
      }
    }

    // Resolve the flat talent struct once, before the stat pass + ability
    // resolver below consume it (they only ever read these flat numbers).
    meta.talentMods = computeTalentModifiers(cls, meta.talents);
    this.refreshKnownAbilities(meta, false);
    recalcPlayerStats(player, cls, meta.equipment, meta.talentMods);
    if (savedState) {
      player.hp = Math.max(1, Math.min(player.maxHp, savedState.hp));
      player.resource =
        classDef.resourceType === 'mana'
          ? Math.min(player.maxResource, Math.max(0, savedState.resource))
          : classDef.resourceType === 'energy'
            ? 100
            : 0;
    } else {
      player.hp = player.maxHp;
      player.resource =
        classDef.resourceType === 'mana'
          ? player.maxResource
          : classDef.resourceType === 'energy'
            ? 100
            : 0;
    }
    player.swingTimer = 0;
    if (savedState?.pet) this.restorePet(player, savedState.pet);
    return player.id;
  }

  removePlayer(pid: number): void {
    const meta = this.players.get(pid);
    if (!meta) return;
    // If the leaver owns a live lockpick session, abandon it (preserves
    // attemptAvailable so a remaining party member can still pick the chest).
    // Must run before party removal / dropEntity, since delveRunForPlayer
    // resolves via the still-present entity position and party key.
    const leavingRun = this.delveRunForPlayer(pid);
    if (leavingRun?.lockpick && leavingRun.lockpick.ownerId === pid)
      this.abandonLockpick(leavingRun);
    // leave social systems cleanly. removeFromParty lives on the PartyMachine now
    // (A1); reach it through the seam, keeping this call in its load-bearing
    // teardown position (must run while the leaver is still in players/entities).
    this.ctx.removeFromParty(pid, 'has left the party');
    const trade = this.trades.get(pid);
    if (trade) this.tradeCancel(pid);
    const duel = this.duels.get(pid);
    if (duel) this.endDuel(duel, duel.a === pid ? duel.b : duel.a);
    // arena: leaving the queue is free; disconnecting mid-bout forfeits it
    this.arenaDequeue(pid);
    const match = this.arenaMatches.get(pid);
    if (match) {
      const team = this.arenaTeamOf(match, pid);
      this.endArenaMatch(match, team === 'A' ? 'B' : team === 'B' ? 'A' : null, 'forfeit');
    }
    this.party.partyInvites.delete(pid);
    this.tradeInvites.delete(pid);
    this.duelInvites.delete(pid);
    // mobs forget the leaving player; persistent hunter pets are serialized
    // with the character and removed from the live world instead of released
    const pet = this.petOf(pid, true);
    if (pet) this.despawnPersistentPet(pet);
    for (const m of this.entities.values()) {
      if (m.kind !== 'mob') continue;
      m.threat.delete(pid);
      if (m.forcedTargetId === pid) {
        m.forcedTargetId = null;
        m.forcedTargetTimer = 0;
      }
      if (m.aggroTargetId === pid) {
        m.aggroTargetId = null;
        if (!m.dead && m.aiState !== 'dead' && m.ownerId === null) this.retargetMob(m);
      }
      if (m.tappedById === pid && !m.dead) m.tappedById = null;
    }
    for (const other of this.players.values()) {
      const e = this.entities.get(other.entityId);
      if (e && e.targetId === pid) e.targetId = null;
    }
    this.dropEntity(pid);
    this.players.delete(pid);
    this.chatTokens.delete(pid);
    this.channelSubs.delete(pid);
    // The caller serializes the character before removePlayer (saveCharacterOnLeave),
    // and serializePet reads delvePetStash when the pet is stowed for a delve, so the
    // pet is already persisted by now. Drop the transient stash entry here so the map
    // can't grow unbounded across sessions.
    this.delvePetStash.delete(pid);
    if (this.primaryId === pid)
      this.primaryId = this.players.size > 0 ? [...this.players.keys()][0] : -1;
  }

  serializeCharacter(pid: number): CharacterState | null {
    const meta = this.players.get(pid);
    const e = this.entities.get(pid);
    if (!meta || !e) return null;
    // While a Fiesta bout has standardized this character to level 20 with a
    // throwaway build, persist the PRE-fiesta snapshot so an autosave or
    // mid-match disconnect never writes the temporary state to the database.
    const restore = meta.fiestaRestore;
    const state: CharacterState = {
      level: restore ? restore.level : e.level,
      xp: restore ? restore.xp : meta.xp,
      lifetimeXp: meta.lifetimeXp,
      prestigeRank: meta.prestigeRank,
      unlockedMilestones: [...meta.unlockedMilestones],
      restedXp: meta.restedXp,
      copper: meta.copper,
      hp: e.hp,
      resource: e.resource,
      pos: { x: e.pos.x, z: e.pos.z },
      facing: e.facing,
      equipment: { ...meta.equipment },
      inventory: meta.inventory.map((i) => ({ ...i })),
      vendorBuyback: meta.vendorBuyback.map((i) => ({ ...i })),
      questLog: [...meta.questLog.values()].map((q) => ({
        questId: q.questId,
        counts: [...q.counts],
        state: q.state,
      })),
      questsDone: [...meta.questsDone],
      arenaRating: meta.arenaRating,
      arenaWins: meta.arenaWins,
      arenaLosses: meta.arenaLosses,
      arena1v1Rating: meta.arenaRating,
      arena1v1Wins: meta.arenaWins,
      arena1v1Losses: meta.arenaLosses,
      arena2v2Rating: meta.arena2v2Rating,
      arena2v2Wins: meta.arena2v2Wins,
      arena2v2Losses: meta.arena2v2Losses,
      talents: cloneAllocation(restore ? restore.talents : meta.talents),
      loadouts: meta.loadouts.map((l) => ({
        name: l.name,
        alloc: cloneAllocation(l.alloc),
        bar: [...l.bar],
      })),
      activeLoadout: meta.activeLoadout,
      raidLockouts: Object.fromEntries(
        [...meta.raidLockouts].filter(([, until]) => until > this.lockoutNowMs()),
      ),
      pet: this.serializePet(pid),
      skin: meta.skin,
      skinCatalog: meta.skinCatalog,
      pendingSkinRank: meta.pendingSkinRank,
      pendingSkinCatalog: meta.pendingSkinCatalog,
      pendingSkinItemId: meta.pendingSkinItemId,
      delveMarks: meta.delveMarks,
      delveClears: { ...meta.delveClears },
      companionUpgrades: { ...meta.companionUpgrades },
      delveLoreUnlocked: [...meta.delveLoreUnlocked],
      delveDaily: {
        date: meta.delveDaily.date,
        firstClearXp: [...meta.delveDaily.firstClearXp],
        markClears: meta.delveDaily.markClears,
      },
    };
    return sanitizeRemovedZone1Content(state).state;
  }

  /** Set a player's appearance skin (meta + entity). Bounded; the renderer
   *  falls back to the default for an unknown index. Used by creation, the
   *  in-game changer, and the server's changeSkin command. */
  setPlayerSkin(pid: number, skin: number, catalog: SkinCatalog = 'class'): boolean {
    const meta = this.players.get(pid);
    const e = this.entities.get(pid);
    if (!meta || !e) return false;
    const maxSkin = catalog === 'mech' ? MECH_CHROMAS.length - 1 : 7;
    const idx = Math.max(0, Math.min(maxSkin, Math.floor(skin)));
    meta.skin = idx;
    meta.skinCatalog = catalog;
    e.skin = idx;
    e.skinCatalog = catalog;
    return true;
  }

  changeSkin(skin: number, catalog: SkinCatalog = 'class'): void {
    this.setPlayerSkin(this.primaryId, skin, catalog);
  }

  /** Set a player's guild name (online only) so it rides the entity wire and
   *  shows under their nameplate. Guilds live in the server social DB, not the
   *  Sim, so this is a passive display field. Offline/headless leave it ''. */
  setPlayerGuild(pid: number, guild: string): void {
    const e = this.entities.get(pid);
    if (e) e.guild = guild;
  }

  /** Cosmetic skin-select event: rolls a rarity rank (once) and emits the
   *  personal `skinEvent` cue that opens the client overlay. Re-using the token
   *  re-shows the already-rolled rank — no reroll — so a player can't spam-roll.
   *  The token is consumed on claim (claimEventSkin), not here. */
  private openSkinSelect(meta: PlayerMeta, catalog: SkinCatalog, itemId: string): void {
    if (meta.pendingSkinRank === null) {
      meta.pendingSkinRank = rollSkinRank(this.rng.next());
      meta.pendingSkinCatalog = catalog;
      meta.pendingSkinItemId = itemId;
    } else {
      meta.pendingSkinCatalog = meta.pendingSkinCatalog ?? catalog;
      meta.pendingSkinItemId = meta.pendingSkinItemId ?? itemId;
    }
    const eventCatalog = meta.pendingSkinCatalog ?? 'class';
    this.emit({
      type: 'skinEvent',
      rank: meta.pendingSkinRank,
      catalog: eventCatalog === 'mech' ? 'mech' : undefined,
      pid: meta.entityId,
    });
  }

  /** Lock in a chosen skin from the skin-select event. Server-authoritative:
   *  rejects (no-op) unless there's a pending rank, the skin's tier is within
   *  that rank, and the player still holds the token. Consumes one token and
   *  clears the pending rank on success. Satisfies IWorld.claimEventSkin. */
  claimEventSkin(skin: number, pid?: number): SkinClaimResult | null {
    const r = this.resolve(pid);
    if (!r) return null;
    const { meta } = r;
    const granted = meta.pendingSkinRank;
    if (granted === null) return null; // no active event
    const catalog = meta.pendingSkinCatalog ?? 'class';
    const tokenItemId = meta.pendingSkinItemId ?? EVENT_SKIN_TOKEN_ID;
    if (this.countItem(tokenItemId, meta.entityId) <= 0) return null; // token gone
    if (catalog === 'mech') {
      if (!rankAllowsMechChroma(granted, skin)) return null; // chroma tier above rolled rank
      const chroma = MECH_CHROMAS[skin];
      if (!chroma) return null;
      this.removeItem(tokenItemId, 1, meta.entityId);
      meta.pendingSkinRank = null;
      meta.pendingSkinCatalog = null;
      meta.pendingSkinItemId = null;
      const mechChromaIds = this.accountCosmetics.mechChromaIds.includes(chroma.id)
        ? this.accountCosmetics.mechChromaIds
        : [...this.accountCosmetics.mechChromaIds, chroma.id];
      this.accountCosmetics = { ...this.accountCosmetics, mechChromaIds };
      this.setPlayerSkin(meta.entityId, skin, 'mech');
      return { catalog: 'mech', skin, chromaId: chroma.id };
    }
    if (!rankAllowsSkin(granted, skin)) return null; // tier above the rolled rank
    if (!classHasSkin(meta.cls, skin)) return null; // skin doesn't exist for this class
    this.removeItem(tokenItemId, 1, meta.entityId);
    this.setPlayerSkin(meta.entityId, skin);
    meta.pendingSkinRank = null;
    meta.pendingSkinCatalog = null;
    meta.pendingSkinItemId = null;
    return { catalog: 'class', skin };
  }

  private unlockMechChromaFromItem(
    meta: PlayerMeta,
    itemId: string,
    chromaId: string,
  ): ItemUseResult | undefined {
    const skin = mechChromaSkinIndex(chromaId);
    if (skin < 0) return undefined;
    if (this.countItem(itemId, meta.entityId) <= 0) return undefined;
    this.removeItem(itemId, 1, meta.entityId);
    const mechChromaIds = this.accountCosmetics.mechChromaIds.includes(chromaId)
      ? this.accountCosmetics.mechChromaIds
      : [...this.accountCosmetics.mechChromaIds, chromaId];
    this.accountCosmetics = { ...this.accountCosmetics, mechChromaIds };
    this.setPlayerSkin(meta.entityId, skin, 'mech');
    return { type: 'mechChroma', chromaId };
  }

  unequipMechChroma(chromaId: string, pid?: number): boolean {
    const r = this.resolve(pid);
    if (!r) return false;
    const skin = mechChromaSkinIndex(chromaId);
    const itemId = mechChromaItemId(chromaId);
    if (skin < 0 || !itemId) return false;
    if (!this.accountCosmetics.mechChromaIds.includes(chromaId)) return false;
    this.accountCosmetics = {
      ...this.accountCosmetics,
      mechChromaIds: this.accountCosmetics.mechChromaIds.filter((id) => id !== chromaId),
    };
    for (const meta of this.players.values()) {
      if (meta.skinCatalog === 'mech' && meta.skin === skin) {
        this.setPlayerSkin(meta.entityId, 0, 'class');
      }
    }
    this.addItem(itemId, 1, r.meta.entityId);
    return true;
  }

  // -------------------------------------------------------------------------
  // Back-compat accessors: single-player contexts (offline game, RL env, tests)
  // address "the" player; these delegate to the primary player.
  // -------------------------------------------------------------------------

  get playerId(): number {
    return this.primaryId;
  }
  get player(): Entity {
    return this.entities.get(this.primaryId)!;
  }
  private get primary(): PlayerMeta {
    return this.players.get(this.primaryId)!;
  }
  get moveInput(): MoveInput {
    return this.primary.moveInput;
  }
  get inventory(): InvSlot[] {
    return this.primary.inventory;
  }
  get vendorBuyback(): InvSlot[] {
    return this.primary.vendorBuyback;
  }
  get equipment(): PlayerEquipment {
    return this.primary.equipment;
  }
  get copper(): number {
    return this.primary.copper;
  }
  set copper(v: number) {
    this.primary.copper = v;
  }
  get xp(): number {
    return this.primary.xp;
  }
  set xp(v: number) {
    this.primary.xp = v;
  }
  get lifetimeXp(): number {
    return this.primary.lifetimeXp;
  }
  get restedXp(): number {
    return this.primary.restedXp;
  }
  get prestigeRank(): number {
    return this.primary.prestigeRank;
  }
  get unlockedMilestones(): string[] {
    return [...this.primary.unlockedMilestones];
  }
  // Offline leaderboard: rank the players the local sim knows about by lifetime
  // XP. Online play overrides this with the cached, realm-scoped server query.
  // Paged through the same helper the server uses so both worlds behave alike.
  leaderboard(page = 0, pageSize = LEADERBOARD_PAGE_SIZE): Promise<LeaderboardPage> {
    const rows = [...this.players.values()]
      .map((m) => {
        const e = this.entities.get(m.entityId);
        return e ? { meta: m, e } : null;
      })
      .filter((x): x is { meta: PlayerMeta; e: Entity } => x !== null)
      .sort(
        (a, b) =>
          b.meta.lifetimeXp - a.meta.lifetimeXp ||
          b.e.level - a.e.level ||
          a.meta.name.localeCompare(b.meta.name),
      )
      .map(({ meta, e }, i) => ({
        rank: i + 1,
        name: meta.name,
        cls: meta.cls,
        level: e.level,
        virtualLevel: virtualLevel(meta.lifetimeXp),
        lifetimeXp: meta.lifetimeXp,
        prestigeRank: meta.prestigeRank,
      }));
    return Promise.resolve(paginateLeaderboard(rows, page, pageSize));
  }
  get known(): ResolvedAbility[] {
    return this.primary.known;
  }
  get questLog(): Map<string, QuestProgress> {
    return this.primary.questLog;
  }
  get questsDone(): Set<string> {
    return this.primary.questsDone;
  }
  raidLockouts(): import('../world_api').RaidLockout[] {
    const now = this.lockoutNowMs();
    const out: import('../world_api').RaidLockout[] = [];
    for (const [id, until] of this.primary.raidLockouts) {
      const msRemaining = until - now;
      if (msRemaining > 0) out.push({ id, msRemaining });
    }
    return out;
  }
  get counters(): RewardCounters {
    return this.primary.counters;
  }
  get talents(): TalentAllocation {
    return this.primary.talents;
  }
  get talentSpec(): string | null {
    return this.primary.talentMods.spec;
  }
  get talentRole(): Role | null {
    return this.primary.talentMods.role;
  }
  get loadouts(): SavedLoadout[] {
    return this.primary.loadouts;
  }
  get activeLoadout(): number {
    return this.primary.activeLoadout;
  }

  meta(pid: number): PlayerMeta | null {
    return this.players.get(pid) ?? null;
  }

  private resolve(pid?: number): { meta: PlayerMeta; e: Entity } | null {
    const id = pid ?? this.primaryId;
    const meta = this.players.get(id);
    const e = this.entities.get(id);
    if (!meta || !e) return null;
    return { meta, e };
  }

  playerGcdFor(cls: PlayerClass): number {
    return cls === 'rogue' ? 1.0 : GCD; // rogue GCD is 1.0 sec
  }
  get playerGcd(): number {
    return this.playerGcdFor(this.primary.cls);
  }

  groundPos(x: number, z: number): Vec3 {
    return { x, y: groundHeight(x, z, this.cfg.seed), z };
  }

  // Deterministic outward spiral to the nearest spot that is on dry-enough
  // ground and not inside a building/prop. Keeps NPCs out of houses and lakes.
  findSafePos(x: number, z: number, minHeight: number): { x: number; z: number } {
    const seed = this.cfg.seed;
    const ok = (px: number, pz: number): boolean => {
      if (groundHeight(px, pz, seed) < minHeight) return false;
      const res = resolvePosition(seed, px, pz, 0.6);
      return Math.abs(res.x - px) < 1e-4 && Math.abs(res.z - pz) < 1e-4;
    };
    if (ok(x, z)) return { x, z };
    const GOLDEN = 2.39996; // radians; even angular coverage
    for (let i = 1; i <= 80; i++) {
      const r = 0.9 * Math.sqrt(i) * 2.2;
      const a = i * GOLDEN;
      const px = x + Math.sin(a) * r;
      const pz = z + Math.cos(a) * r;
      if (ok(px, pz)) return { x: px, z: pz };
    }
    return { x, z };
  }

  emit(ev: SimEvent): void {
    this.events.push(ev);
  }

  /** Drain queued events without advancing simulation (offline HUD sync). */
  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // Build the shared SimContext seam (S0b). Pure plumbing: it exposes the live core
  // primitives (rng/time/tickCount/entities via getters) and binds the still-on-Sim
  // methods the early extracted slices call. It MOVES NO behavior - every callback
  // routes straight back to the Sim method of the same name (the callback registry
  // in 02-WORKING-MEMORY.md). As a later slice owns one of these, it reimplements the
  // callback in its own module without renaming it here, so consumers never change.
  private buildSimContext(): SimContext {
    const sim = this;
    const host: SimContextHost = {
      get rng() {
        return sim.rng;
      },
      get time() {
        return sim.time;
      },
      get tickCount() {
        return sim.tickCount;
      },
      get entities() {
        return sim.entities;
      },
      get players() {
        return sim.players;
      },
      get tradeInvites() {
        return sim.tradeInvites;
      },
      get duelInvites() {
        return sim.duelInvites;
      },
      get nextId() {
        return sim.nextId;
      },
      set nextId(v) {
        sim.nextId = v;
      },
      get grid() {
        return sim.grid;
      },
      get playerGrid() {
        return sim.playerGrid;
      },
      get delayedEvents() {
        return sim.delayedEvents;
      },
      set delayedEvents(v) {
        sim.delayedEvents = v;
      },
      get groundAoEs() {
        return sim.groundAoEs;
      },
      get dungeonDoorIds() {
        return sim.dungeonDoorIds;
      },
      set dungeonDoorIds(v) {
        sim.dungeonDoorIds = v;
      },
      get instances() {
        return sim.instances;
      },
      get arenaMatches() {
        return sim.arenaMatches;
      },
      get duels() {
        return sim.duels;
      },
      get cfg() {
        return sim.cfg;
      },
      // A2: duel + arena state stays on Sim, exposed as live views (backing fields
      // mutated in place / the queues reassigned by the matchmaker filter).
      get trades() {
        return sim.trades;
      },
      get arenaQueue1v1() {
        return sim.arenaQueue1v1;
      },
      set arenaQueue1v1(v) {
        sim.arenaQueue1v1 = v;
      },
      get arenaQueue2v2() {
        return sim.arenaQueue2v2;
      },
      set arenaQueue2v2(v) {
        sim.arenaQueue2v2 = v;
      },
      get arenaQueueFiesta() {
        return sim.arenaQueueFiesta;
      },
      set arenaQueueFiesta(v) {
        sim.arenaQueueFiesta = v;
      },
      get arenaBusySlots() {
        return sim.arenaBusySlots;
      },
      get nextArenaMatchId() {
        return sim.nextArenaMatchId;
      },
      set nextArenaMatchId(v) {
        sim.nextArenaMatchId = v;
      },
      get delveRuns() {
        return sim.delveRuns;
      },
      get delvePetStash() {
        return sim.delvePetStash;
      },
      get utcDay() {
        return sim.utcDay;
      },
      emit: sim.emit.bind(sim),
      dealDamage: sim.dealDamage.bind(sim),
      handleDeath: sim.handleDeath.bind(sim),
      cancelCast: sim.cancelCast.bind(sim),
      pushbackCast: sim.pushbackCast.bind(sim),
      refreshMobLeashFromAction: sim.refreshMobLeashFromAction.bind(sim),
      retargetMob: sim.retargetMob.bind(sim),
      nythraxisAddFallbackTarget: sim.nythraxisAddFallbackTarget.bind(sim),
      scheduleNythraxisAddDespawnIfBossReset: sim.scheduleNythraxisAddDespawnIfBossReset.bind(sim),
      isArenaCrossTeam: sim.isArenaCrossTeam.bind(sim),
      arenaTeamOf: sim.arenaTeamOf.bind(sim),
      endArenaMatch: sim.endArenaMatch.bind(sim),
      endDuel: sim.endDuel.bind(sim),
      fiestaTakedown: sim.fiestaTakedown.bind(sim),
      fiestaDown: sim.fiestaDown.bind(sim),
      // A2: isArenaCrossTeam/arenaTeamOf/endArenaMatch/endDuel (above) now forward to
      // social/arena.ts + social/duel.ts via Sim's thin delegates. The block below is
      // what the moved code CONSUMES that stays on Sim (clearAurasFromSource has
      // non-duel callers; entityInDungeon/hasPendingSocialInvite are core; the five
      // fiesta* hooks are A3-owned), plus the arena bodies EXPOSED for Fiesta (A3).
      clearAurasFromSource: sim.clearAurasFromSource.bind(sim),
      entityInDungeon: sim.entityInDungeon.bind(sim),
      hasPendingSocialInvite: sim.hasPendingSocialInvite.bind(sim),
      createFiestaState: sim.createFiestaState.bind(sim),
      fiestaStandardize: sim.fiestaStandardize.bind(sim),
      updateFiestaActive: sim.updateFiestaActive.bind(sim),
      fiestaRestoreChar: sim.fiestaRestoreChar.bind(sim),
      clearFiestaAugments: sim.clearFiestaAugments.bind(sim),
      readyArenaFighter: sim.readyArenaFighter.bind(sim),
      resetForArena: sim.resetForArena.bind(sim),
      isArenaTeamWiped: sim.isArenaTeamWiped.bind(sim),
      arenaIsDown: sim.arenaIsDown.bind(sim),
      arenaAllPids: sim.arenaAllPids.bind(sim),
      rollLoot: sim.rollLoot.bind(sim),
      applyHeal: sim.applyHeal.bind(sim),
      spellCrit: sim.spellCrit.bind(sim),
      applyAura: sim.applyAura.bind(sim),
      applyRootAura: sim.applyRootAura.bind(sim),
      applyKnockback: sim.applyKnockback.bind(sim),
      diminishedCrowdControlDuration: sim.diminishedCrowdControlDuration.bind(sim),
      hostilesInRadius: sim.hostilesInRadius.bind(sim),
      breakStealth: sim.breakStealth.bind(sim),
      applyTaunt: sim.applyTaunt.bind(sim),
      summonPet: sim.summonPet.bind(sim),
      petOf: sim.petOf.bind(sim),
      completeTame: sim.completeTame.bind(sim),
      clearEntityMarker: sim.clearEntityMarker.bind(sim),
      // partyOf stays bound to Sim's thin delegate (it forwards to this.party);
      // removeFromParty + dropPartyMarkers route straight to the moved machine /
      // the still-on-Sim marker store. points-at = social/party (A1) for the first
      // two; dropPartyMarkers points at Sim until T1 owns the marker store.
      partyOf: sim.partyOf.bind(sim),
      removeFromParty: (pid: number, verb: string) => sim.party.removeFromParty(pid, verb),
      dropPartyMarkers: (partyId: number) => {
        sim.partyMarkers.delete(partyId);
      },
      // Q1 quest-credit trio now lives in quests/quest_credit.ts; the callbacks route
      // through `sim.ctx` (lazily read at call time, after the ctor sets it). countItem
      // stays on Sim (L2 inventory hub) and is consumed by the collect updater.
      onMobKilledForQuests: (mob, meta) => onMobKilledForQuests(sim.ctx, mob, meta),
      onInventoryChangedForQuests: (meta) => onInventoryChangedForQuests(sim.ctx, meta),
      checkQuestReady: (qp, meta) => checkQuestReady(sim.ctx, qp, meta),
      countItem: sim.countItem.bind(sim),
      // I1 dungeon instancing now lives in instances/dungeons.ts; these route through
      // the same-named Sim delegates (foreign callers use this.X). lockoutNowMs is the
      // shared raid-lockout clock that stays on Sim (N1 also writes through it).
      lockoutNowMs: sim.lockoutNowMs.bind(sim),
      instanceKeyFor: sim.instanceKeyFor.bind(sim),
      instanceOriginOf: sim.instanceOriginOf.bind(sim),
      enterDungeon: sim.enterDungeon.bind(sim),
      leaveDungeon: sim.leaveDungeon.bind(sim),
      addEntity: sim.addEntity.bind(sim),
      dropEntity: sim.dropEntity.bind(sim),
      rebucket: sim.rebucket.bind(sim),
      resolve: sim.resolve.bind(sim),
      groundPos: sim.groundPos.bind(sim),
      playerMods: sim.playerMods.bind(sim),
      delveRunForPlayer: sim.delveRunForPlayer.bind(sim),
      delveModuleEntry: sim.delveModuleEntry.bind(sim),
      failDelveRun: sim.failDelveRun.bind(sim),
      pulseGroundAoE: sim.pulseGroundAoE.bind(sim),
      enterCombat: sim.enterCombat.bind(sim),
      hexOutputMult: sim.hexOutputMult.bind(sim),
      critVulnBonus: sim.critVulnBonus.bind(sim),
      pvpController: sim.pvpController.bind(sim),
      threatMod: sim.threatMod.bind(sim),
      clearNonPlayerStatAuras: sim.clearNonPlayerStatAuras.bind(sim),
      // C3 aura/regen runner (combat/auras.ts) consumes these: the incoming-heal mult +
      // effective-healing threat (both delegate to combat/heal.ts), and the per-aura stat
      // apply/remove on expiry (stays on Sim).
      healingTakenMult: sim.healingTakenMult.bind(sim),
      healingThreat: sim.healingThreat.bind(sim),
      applyNonPlayerStatAura: sim.applyNonPlayerStatAura.bind(sim),
      grantNythraxisLockout: sim.grantNythraxisLockout.bind(sim),
      frenzyPackmates: sim.frenzyPackmates.bind(sim),
      armDeathThroes: sim.armDeathThroes.bind(sim),
      refreshKnownAbilities: sim.refreshKnownAbilities.bind(sim),
      syncPetLevel: sim.syncPetLevel.bind(sim),
      // M2 mob locomotion seam (all still on Sim; owners flip points-at later).
      moveToward: sim.moveToward.bind(sim),
      mobSwing: sim.mobSwing.bind(sim),
      updateRangedPetAttack: sim.updateRangedPetAttack.bind(sim),
      fleeMoveSpeed: sim.fleeMoveSpeed.bind(sim),
      usesProfiledMobCombat: sim.usesProfiledMobCombat.bind(sim),
      updateProfiledMobCombat: sim.updateProfiledMobCombat.bind(sim),
      tryMobMeleeSwingInRange: sim.tryMobMeleeSwingInRange.bind(sim),
      maybeFlee: sim.maybeFlee.bind(sim),
      aggroMob: sim.aggroMob.bind(sim),
      // C3 moved the CC predicates to combat/cc.ts; ctx.isStunned/isRooted (consumed by
      // mob/locomotion.ts, M2) now point at those pure functions instead of Sim methods.
      isStunned: isStunned,
      isRooted: isRooted,
      moveSpeedMult: sim.moveSpeedMult.bind(sim),
      swingIntervalMult: sim.swingIntervalMult.bind(sim),
      mobEffectiveMeleeRange: sim.mobEffectiveMeleeRange.bind(sim),
      mobCanSwim: sim.mobCanSwim.bind(sim),
      resolveMovePoint: sim.resolveMovePoint.bind(sim),
      updatePet: sim.updatePet.bind(sim),
      isDelveCompanionMob: sim.isDelveCompanionMob.bind(sim),
      updateDelveCompanion: sim.updateDelveCompanion.bind(sim),
      updateBossMechanics: sim.updateBossMechanics.bind(sim),
      updateNythraxisEncounter: sim.updateNythraxisEncounter.bind(sim),
      resetNythraxisEncounter: sim.resetNythraxisEncounter.bind(sim),
      despawnSummonedAdds: sim.despawnSummonedAdds.bind(sim),
      updateFearMovement: sim.updateFearMovement.bind(sim),
      detonateCorpse: sim.detonateCorpse.bind(sim),
      respawnMob: sim.respawnMob.bind(sim),
      onBossDeath: sim.onBossDeath.bind(sim),
      // M3 mob on-hit affix cascade seam: effectiveArmor (cleave splash armor) +
      // the devour recalc wrapper. Both stay on Sim; the cascade reaches them via ctx.
      effectiveArmor: sim.effectiveArmor.bind(sim),
      recalcPlayer: sim.recalcPlayer.bind(sim),
      // I2a delve run lifecycle now lives in src/sim/delves/runs.ts; the moved module
      // reaches the still-on-Sim helpers / gate predicates / pet seam / I2b lockpick /
      // I2c companion through these delegates. The five reach-in callbacks resolve back
      // to the moved body via the Sim delegate (delveRunForMob/onDelveBossDefeated/
      // delveDetectMult/startDelveRaiseDeadChannel + delveRunForPlayer above). These wrap
      // still-on-Sim methods as LATE-bound arrows (looked up at call time, not `.bind`d at
      // ctor) so they preserve the pre-move `this.X` semantics exactly, including tests
      // that reassign a method (e.g. delves.test.ts swaps sim.grantXp to observe payout).
      // grantXp/delveRunForMob/onDelveBossDefeated/delveDetectMult/despawnPet were also
      // bound above by C1/M2/C3 (eager .bind); deduped here to the I2a late-bound form so
      // the reassign-aware delve tests hold. grantXp/despawnPet stay Sim; the three delve
      // reach-ins delegate to delves/runs via their Sim method body.
      partyMembersForKey: (key) => sim.partyMembersForKey(key),
      grantXp: (amount, meta, opts) => sim.grantXp(amount, meta, opts),
      addItem: (itemId, count, pid) => sim.addItem(itemId, count, pid),
      spawnBossAdds: (boss, mobId, count) => sim.spawnBossAdds(boss, mobId, count),
      tradeFor: (pid) => sim.tradeFor(pid),
      duelFor: (pid) => sim.duelFor(pid),
      serializePet: (ownerPid) => sim.serializePet(ownerPid),
      restorePet: (owner, state) => sim.restorePet(owner, state),
      despawnPet: (pet) => sim.despawnPet(pet),
      despawnPersistentPet: (pet) => sim.despawnPersistentPet(pet),
      isPetClass,
      spawnDelveCompanion: (run, pid, companionId) =>
        sim.spawnDelveCompanion(run, pid, companionId),
      despawnDelveCompanion: (run) => sim.despawnDelveCompanion(run),
      maybeCompanionBark: (run, pid, barkId) => sim.maybeCompanionBark(run, pid, barkId),
      abandonLockpick: (run) => sim.abandonLockpick(run),
      tickLockpickTimeout: (run) => sim.tickLockpickTimeout(run),
      delveRunForMob: (mobId) => sim.delveRunForMob(mobId),
      onDelveBossDefeated: (run) => sim.onDelveBossDefeated(run),
      delveDetectMult: (player) => sim.delveDetectMult(player),
      startDelveRaiseDeadChannel: (run, boss, mobId, count) =>
        sim.startDelveRaiseDeadChannel(run, boss, mobId, count),
      resolvedAbility: sim.resolvedAbility.bind(sim),
      playerGcdFor: sim.playerGcdFor.bind(sim),
      // LATE-bound (not .bind(sim)): the moved cast guards emit through ctx.error, and
      // several tests swap (sim as any).error post-construction to observe the message.
      // A .bind(sim) would early-capture the original method and bypass that stub,
      // breaking the `this.error` dynamic-dispatch semantics the pre-move code had.
      error: (pid, text, reason) => sim.error(pid, text, reason),
      isFriendlyTo: sim.isFriendlyTo.bind(sim),
      isHostileTo: sim.isHostileTo.bind(sim),
      lineOfSightBlocked: sim.lineOfSightBlocked.bind(sim),
      stopFollow: sim.stopFollow.bind(sim),
      tameError: sim.tameError.bind(sim),
      standUp: sim.standUp.bind(sim),
      breakGhostWolf: sim.breakGhostWolf.bind(sim),
      startAutoAttack: sim.startAutoAttack.bind(sim),
      revivePet: sim.revivePet.bind(sim),
      completeFishing: sim.completeFishing.bind(sim),
      applyDemonHealTick: sim.applyDemonHealTick.bind(sim),
      runEffects: sim.runEffects.bind(sim),
    };
    return createSimContext(host);
  }

  private refreshKnownAbilities(meta: PlayerMeta, announce: boolean): void {
    const e = this.entities.get(meta.entityId);
    if (!e) return;
    const before = new Map(meta.known.map((k) => [k.def.id, k.rank]));
    meta.known = abilitiesKnownAt(meta.cls, e.level, meta.talentMods);
    if (announce) {
      for (const k of meta.known) {
        const prev = before.get(k.def.id);
        if (prev === undefined || prev < k.rank) {
          this.emit({
            type: 'learnAbility',
            abilityId: k.def.id,
            rank: k.rank,
            pid: meta.entityId,
          });
          this.emit({
            type: 'log',
            pid: meta.entityId,
            text:
              prev === undefined
                ? `You have learned a new ability: ${k.def.name}.`
                : `Your ${k.def.name} has improved to Rank ${k.rank}.`,
            color: '#ffd100',
          });
        }
      }
    }
  }

  // Mark a player as a GM: invulnerable (see dealDamage). Server-side only —
  // set at join time from the characters.is_gm column.
  setGm(pid?: number): void {
    const r = this.resolve(pid);
    if (r) r.e.gm = true;
  }

  // Dev/test convenience: jump a player to a level (learns abilities, recalcs stats).
  setPlayerLevel(level: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    r.e.level = Math.max(1, Math.min(MAX_LEVEL, level));
    // Keep lifetimeXp consistent with the level so post-cap progression starts
    // from a sane baseline (virtualLevel never falls below the real level). Only
    // ever raises it — lifetimeXp is monotonic.
    r.meta.lifetimeXp = Math.max(r.meta.lifetimeXp, xpToReachLevel(r.e.level));
    recalcPlayerStats(r.e, r.meta.cls, r.meta.equipment, this.playerMods(r.meta));
    r.e.hp = r.e.maxHp;
    if (r.e.resourceType === 'mana') r.e.resource = r.e.maxResource;
    this.refreshKnownAbilities(r.meta, false);
    this.syncPetLevel(r.e);
  }

  // -------------------------------------------------------------------------
  // Talents & Specializations (server-authoritative). The application layer
  // (validate -> bake the flat TalentModifiers struct -> manage specs + the named
  // loadouts) lives in progression/talents.ts (G1a). These stay here as thin wrappers
  // that delegate into the module via this.ctx, so the IWorld / server-command surface
  // (sim.applyTalents(...) etc.) is unchanged. recomputeTalents (the SOLE tree walk),
  // talentLockReason, and sanitizeTalentAllocation are module-internal there. The
  // talent-facing getters (talents/talentSpec/talentRole/loadouts/activeLoadout) and
  // playerMods (the Fiesta overlay) stay on Sim.
  // -------------------------------------------------------------------------

  talentPoints(pid?: number): { total: number; spent: number } {
    return talentPointBudget(this.ctx, pid);
  }

  // Commit a whole staged allocation in one shot (the UI's "Apply"). Rejects any
  // allocation that fails server-side validation with a reason event (FR-4.5).
  applyTalents(alloc: TalentAllocation, pid?: number): boolean {
    return applyTalentAllocation(this.ctx, alloc, pid);
  }

  // Spend a single point into a node (incremental API; the UI mostly stages then
  // applies). Validated identically by building + checking a candidate alloc.
  spendTalent(nodeId: string, pid?: number): boolean {
    return spendTalentPoint(this.ctx, nodeId, pid);
  }

  // Choose / change specialization. Switching specs drops the previous spec
  // tree's points (they belonged to that tree); the class tree is untouched.
  setSpec(specId: string | null, pid?: number): boolean {
    return setTalentSpec(this.ctx, specId, pid);
  }

  // Free respec (out of combat): wipe all talent points. Spec is retained.
  respec(pid?: number): boolean {
    return respecTalents(this.ctx, pid);
  }

  // Save the current build (talents + spec + the given action-bar slot map) as a
  // named loadout. A same-named loadout is overwritten; otherwise appended up to
  // MAX_LOADOUTS. Returns the loadout index (-1 on failure).
  saveLoadout(
    name: string,
    bar: (string | null)[],
    pidOrAlloc?: number | TalentAllocation,
    allocMaybe?: TalentAllocation,
  ): number {
    return saveTalentLoadout(this.ctx, name, bar, pidOrAlloc, allocMaybe);
  }

  // Apply a saved loadout's talents (out of combat). The action bar is restored
  // client-side from the loadout's stored slot map. Re-validated server-side.
  switchLoadout(index: number, pid?: number): boolean {
    return switchTalentLoadout(this.ctx, index, pid);
  }

  deleteLoadout(index: number, pid?: number): boolean {
    return deleteTalentLoadout(this.ctx, index, pid);
  }

  // Threat modifier including the tank-role talent bonus (e.g. Protection's
  // Vengeance Mastery). Reads the precomputed flat threatPct — no tree walk.
  private threatMod(source: Entity, school: string): number {
    let m = threatModifier(source, school);
    if (source.kind === 'player') {
      const meta = this.players.get(source.id);
      if (meta) m *= 1 + this.playerMods(meta).global.threatPct;
    }
    return m;
  }

  resolvedAbility(abilityId: string, pid?: number): ResolvedAbility | null {
    const r = this.resolve(pid);
    if (!r) return null;
    const found = r.meta.known.find((k) => k.def.id === abilityId) ?? null;
    if (!found) return null;
    // A "draining curse" (cost_tax aura) inflates the resource cost of every
    // ability the victim uses. Resolve it here, the single choke point all cost
    // checks/spends read, so the affordability check and the spend stay in
    // lockstep. Return a shallow copy so the cached known-list entry is never
    // mutated.
    const tax = this.costTaxMult(r.e);
    if (tax > 1 && found.cost > 0) return { ...found, cost: Math.ceil(found.cost * tax) };
    return found;
  }

  // Highest active cost_tax aura, expressed as a cost multiplier (1 = no tax).
  private costTaxMult(e: Entity): number {
    let pct = 0;
    for (const a of e.auras) if (a.kind === 'cost_tax' && a.value > pct) pct = a.value;
    return 1 + pct;
  }

  // -------------------------------------------------------------------------
  // Main tick
  // -------------------------------------------------------------------------

  tick(): SimEvent[] {
    // The shared SimContext seam (`this.ctx`, built in the ctor) spans this whole
    // tick: the head/tail phases and the end-of-tick system block all run on the Sim
    // that holds it, so a later slice's extracted update() routes through `this.ctx`
    // without changing the phase order below. S0b threads the seam but moves no
    // behavior, so every phase here is byte-identical (the parity gate proves it).
    this.time += DT;
    this.tickCount++;
    this.updatePendingMobRespawns();
    tickGroundAoEs(this.ctx);

    runDespawnDecay(this.ctx);

    for (const meta of this.players.values()) {
      const p = this.entities.get(meta.entityId);
      if (!p) continue;
      if (!p.dead) {
        this.updatePlayerMovement(p, meta);
        this.updateDoorTriggers(p);
        this.updateCasting(p, meta);
        this.updatePlayerAutoAttack(p, meta);
        updateRegen(this.ctx, p, meta);
        this.updateRested(p, meta);
      }
      updateTimers(p);
      updateAuras(this.ctx, p);
    }

    for (const e of this.entities.values()) {
      if (e.kind === 'mob') {
        this.updateMob(e);
        updateAuras(this.ctx, e);
      } else if (e.kind === 'npc') {
        cleanseFriendlyNpcAuras(this.ctx, e);
      } else if (e.kind === 'object') {
        if (!e.lootable) {
          e.respawnTimer -= DT;
          if (e.respawnTimer <= 0) e.lootable = true;
        }
      }
    }

    // one pass over the entities collects every player a mob is engaged
    // with, instead of one full scan per player
    this.engagedPids.clear();
    for (const e of this.entities.values()) {
      if (e.kind !== 'mob' || e.dead) continue;
      // a wild mob actively engaged keeps its target in combat — and if that
      // target is someone's pet, the pet's owner stays in combat too, so a
      // hunter/warlock can't regen, eat/drink, or use out-of-combat abilities
      // while their pet tanks
      if (
        e.ownerId === null &&
        (e.aiState === 'chase' || e.aiState === 'attack' || e.aiState === 'flee') &&
        e.aggroTargetId !== null
      ) {
        this.engagedPids.add(e.aggroTargetId);
        const tgt = this.entities.get(e.aggroTargetId);
        if (tgt && tgt.ownerId !== null) this.engagedPids.add(tgt.ownerId);
      }
      // a player's pet that is actively fighting an enemy keeps its owner in
      // combat. A pet merely holding a target it is not trading blows with (out of
      // reach, stale) must not freeze the owner's health regen indefinitely (#regen)
      if (e.ownerId !== null && e.aggroTargetId !== null && e.combatTimer < PET_COMBAT_LINGER)
        this.engagedPids.add(e.ownerId);
    }
    for (const meta of this.players.values()) {
      const p = this.entities.get(meta.entityId);
      if (p) p.inCombat = this.engagedPids.has(p.id) || p.combatTimer < 5;
    }

    this.updateDuels();
    this.updateArena();
    this.updateTradesAndInvites();
    this.updateLootRolls();
    this.updateInstances();
    this.updateDelveRuns();
    this.updateMarket();
    drainDelayedEvents(this.ctx);

    // movement re-bucketing: queries during the next tick and the server's
    // snapshot broadcast right after this one see fresh cells
    this.grid.refresh(this.entities.values());
    this.playerGrid.refresh(this.playerEntities());

    const out = this.events;
    this.events = [];
    return out;
  }

  private updateLootRolls(): void {
    for (const roll of [...this.pendingLootRolls.values()]) {
      if (roll.expiresAt <= this.time) this.resolveLootRoll(roll);
    }
  }

  private *playerEntities(): Iterable<Entity> {
    for (const meta of this.players.values()) {
      const e = this.entities.get(meta.entityId);
      if (e) yield e;
    }
  }

  // -------------------------------------------------------------------------
  // Player movement
  // -------------------------------------------------------------------------

  private fearAura(e: Entity): Aura | undefined {
    return e.auras.find((a) => a.id === 'fear_incap' && a.kind === 'incapacitate');
  }
  private updateFearMovement(e: Entity): boolean {
    const aura = this.fearAura(e);
    if (!aura || e.auras.some((a) => a.kind === 'root')) return false;
    const angle = Number.isFinite(aura.value) ? aura.value : e.facing;
    const dest = this.groundPos(e.pos.x + Math.sin(angle) * 10, e.pos.z + Math.cos(angle) * 10);
    this.moveToward(e, dest, this.fleeMoveSpeed(e));
    return true;
  }
  private mobCanSwim(template: { family?: string; canSwim?: boolean } | undefined): boolean {
    return !!template;
  }
  private mobCanSpawnInWater(
    template: { family?: string; canSwim?: boolean } | undefined,
  ): boolean {
    return !!template && (template.canSwim === true || template.family === 'murloc');
  }
  private isControlAura(kind: AuraKind): boolean {
    return kind === 'stun' || kind === 'root' || kind === 'incapacitate' || kind === 'polymorph';
  }
  private isNythraxisControlAura(kind: AuraKind): boolean {
    return kind === 'slow' || this.isControlAura(kind);
  }
  private isNythraxisRaidEnemy(target: Entity): boolean {
    return (
      target.kind === 'mob' &&
      (target.templateId === NYTHRAXIS_BOSS_ID || target.templateId === NYTHRAXIS_ADD_ID)
    );
  }
  private isNythraxisScriptedControl(target: Entity, aura: Aura): boolean {
    return (
      target.kind === 'mob' &&
      (target.templateId === NYTHRAXIS_ADD_ID || target.ownerId !== null) &&
      aura.id === 'nythraxis_transition_stun'
    );
  }
  private partyLootStrategiesForMob(mob: Entity): LootStrategies | null {
    if (mob.tappedById === null) return null;
    return this.partyOf(mob.tappedById)?.lootStrategies ?? null;
  }
  private partyLootCandidatesForMob(mob: Entity): PlayerMeta[] {
    if (mob.lootRecipientIds && mob.lootRecipientIds.length > 0) {
      return mob.lootRecipientIds.flatMap((pid) => {
        const candidate = this.players.get(pid);
        return candidate ? [candidate] : [];
      });
    }
    if (mob.tappedById === null) return [];
    const party = this.partyOf(mob.tappedById);
    if (!party || party.members.length <= 1) return [];
    const candidates: PlayerMeta[] = [];
    for (const pid of party.members) {
      const candidate = this.players.get(pid);
      const e = this.entities.get(pid);
      // Before a corpse has a death-time snapshot, fall back to current range.
      // Do not filter on `e.dead`: a downed member whose corpse is still in
      // range keeps loot rights.
      if (candidate && e && dist2d(e.pos, mob.pos) <= PARTY_XP_RANGE) candidates.push(candidate);
    }
    return candidates;
  }
  private effectiveCurrencyLootStrategy(mob: Entity): CurrencyLootStrategy {
    return this.partyLootStrategiesForMob(mob)?.currency ?? 'looter-takes-all';
  }
  private effectiveItemLootStrategy(itemId: string, mob: Entity): ItemLootStrategy {
    const q = ITEMS[itemId]?.quality ?? 'common';
    const strategies = this.partyLootStrategiesForMob(mob);
    if (!strategies) return 'looter-takes-all';
    return q === 'poor' || q === 'common' ? strategies.commonItems : strategies.premiumItems;
  }
  moveSpeedMult(e: Entity): number {
    let slow = 1,
      speed = 1;
    for (const a of e.auras) {
      if (a.kind === 'slow' || a.kind === 'stealth') slow = Math.min(slow, a.value);
      // buff_speed and form_travel both carry a 1+fraction multiplier (1.4 = +40%).
      if (a.kind === 'buff_speed' || a.kind === 'form_travel') speed = Math.max(speed, a.value);
    }
    // Fiesta move-speed augments (only ever non-zero inside a Fiesta bout).
    if (e.kind === 'player') {
      const ms = this.players.get(e.id)?.fiestaSpecial.moveSpeedPct;
      if (ms) speed += ms;
    }
    return slow * speed;
  }

  private fleeMoveSpeed(e: Entity): number {
    return Math.min(e.moveSpeed * FLEE_SPEED_MULT, FLEE_MAX_SPEED) * this.moveSpeedMult(e);
  }

  // recoverFromFlee moved to mob/locomotion.ts (M2; called only by the flee arm).

  // Fiesta "Moon Boots" power-up: a buff_jump aura multiplies jump height.
  private jumpMult(e: Entity): number {
    let m = 1;
    for (const a of e.auras) if (a.kind === 'buff_jump') m = Math.max(m, a.value);
    return m;
  }

  // Sunder Armor stacks shave flat armor off the defender for physical hits.
  private effectiveArmor(e: Entity): number {
    let armor = e.stats.armor;
    for (const a of e.auras) {
      if (e.kind !== 'player' && a.kind === 'buff_armor') armor += a.value;
      if (a.kind === 'sunder') armor -= a.value * (a.stacks ?? 1);
    }
    return Math.max(0, armor);
  }

  private effectiveAttackPower(e: Entity): number {
    let attackPower = e.attackPower;
    if (e.kind !== 'player') {
      for (const a of e.auras) {
        if (a.kind === 'buff_ap') attackPower += a.value;
        else if (a.kind === 'debuff_ap') attackPower -= a.value;
      }
    }
    return Math.max(0, attackPower);
  }

  private nonPlayerAuraHp(aura: Aura): number {
    if (aura.kind === 'buff_sta') return aura.value * 10;
    if (aura.kind === 'buff_allstats') return aura.value * 10;
    return 0;
  }

  private applyNonPlayerStatAura(target: Entity, aura: Aura, direction: 1 | -1): void {
    if (target.kind === 'player') return;
    const hpDelta = this.nonPlayerAuraHp(aura) * direction;
    if (hpDelta === 0) return;
    const hpFrac = target.maxHp > 0 ? target.hp / target.maxHp : 1;
    target.maxHp = Math.max(1, target.maxHp + hpDelta);
    target.hp = target.dead
      ? 0
      : Math.max(1, Math.min(target.maxHp, Math.round(target.maxHp * hpFrac)));
  }

  private clearNonPlayerStatAuras(target: Entity): void {
    if (target.kind === 'player') return;
    for (const aura of target.auras) this.applyNonPlayerStatAura(target, aura, -1);
  }

  private syncPetAspect(pet: Entity, owner: Entity): void {
    const ownerAspect =
      owner.auras.find((a) => a.id === 'aspect_of_the_hawk' || a.id === 'aspect_of_the_cheetah') ??
      null;
    const aspectId = ownerAspect ? `pet_${ownerAspect.id}` : null;
    for (let i = pet.auras.length - 1; i >= 0; i--) {
      const aura = pet.auras[i];
      if (!aura.id.startsWith('pet_aspect_')) continue;
      if (aspectId !== aura.id) pet.auras.splice(i, 1);
    }
    if (!ownerAspect || !aspectId) return;
    const existing = pet.auras.find((a) => a.id === aspectId);
    if (existing) {
      existing.remaining = ownerAspect.remaining;
      existing.duration = ownerAspect.duration;
      existing.value = ownerAspect.value;
      return;
    }
    pet.auras.push({
      ...ownerAspect,
      id: aspectId,
      sourceId: owner.id,
    });
  }

  // swing interval multiplier: >1 = slower (thunder clap), haste divides
  swingIntervalMult(e: Entity): number {
    let m = 1;
    for (const a of e.auras) {
      if (a.kind === 'attackspeed') m *= a.value;
      if (a.kind === 'buff_haste') m /= a.value;
    }
    // Enrage frenzy: an enraged mob swings faster (mirrors the inline dmgMult
    // applied in mobSwing). Composes with any slow/haste auras above.
    if (e.enraged) {
      const h = MOBS[e.templateId]?.enrage?.hasteMult;
      if (h && h > 0) m /= h;
    }
    return m;
  }

  isSwimming(e: Entity): boolean {
    return (
      groundHeight(e.pos.x, e.pos.z, this.cfg.seed) < WATER_LEVEL - SWIM_DEPTH &&
      e.pos.y <= SWIM_SURFACE_Y + 0.15
    );
  }

  private findChargePath(p: Entity, target: Entity): Vec3[] {
    return findPlayerPath(this.cfg.seed, p.pos, target.pos, 64).map((w) => ({
      x: w.x,
      y: 0,
      z: w.z,
    }));
  }

  // Charge in flight: forced movement toward the target along the pathfound
  // route. Returns true while it owns the player's movement this tick.
  private updateChargeMovement(p: Entity): boolean {
    if (p.chargeTargetId === null) return false;
    const target = this.entities.get(p.chargeTargetId);
    p.chargeTimeLeft -= DT;
    const done = (arrived: boolean): boolean => {
      p.chargeTargetId = null;
      p.chargePath = [];
      if (target) p.facing = angleTo(p.pos, target.pos);
      if (arrived) this.startAutoAttack(p.id);
      return true;
    };
    if (!target || target.dead || p.chargeTimeLeft <= 0 || isRooted(p)) return done(false);
    if (dist2d(p.pos, target.pos) <= CHARGE_ARRIVE_RANGE) return done(true);
    if (p.sitting) this.standUp(p);
    // re-route when the target has run well away from where the path ends
    const pathEnd = p.chargePath[p.chargePath.length - 1];
    if (!pathEnd || dist2d(pathEnd, target.pos) > 4) p.chargePath = this.findChargePath(p, target);
    // steer at the next waypoint; the final leg homes on the live target
    while (p.chargePath.length > 1 && dist2d(p.pos, p.chargePath[0]) < 1) p.chargePath.shift();
    const wp = p.chargePath.length > 1 ? p.chargePath[0] : target.pos;
    p.facing = angleTo(p.pos, wp);
    const step = Math.min(RUN_SPEED * CHARGE_SPEED_MULT * DT, Math.max(0.01, dist2d(p.pos, wp)));
    const nx = p.pos.x + Math.sin(p.facing) * step;
    const nz = p.pos.z + Math.cos(p.facing) * step;
    // deep water and cliffs end the charge early rather than dragging the player in
    const h0 = groundHeight(p.pos.x, p.pos.z, this.cfg.seed);
    const h1 = groundHeight(nx, nz, this.cfg.seed);
    if (h1 < WATER_LEVEL - SWIM_DEPTH) return done(false);
    if (h1 > h0 && (h1 - h0) / step > MAX_CLIMB_SLOPE) return done(false);
    const resolved = this.resolveMove(p.pos.x, p.pos.z, nx, nz, BODY_RADIUS, p);
    p.pos.x = resolved.x;
    p.pos.z = resolved.z;
    p.pos.y = groundHeight(resolved.x, resolved.z, this.cfg.seed);
    p.vy = 0;
    p.onGround = true;
    p.fallStartY = p.pos.y;
    return true;
  }

  // /follow: a second forced-movement mode (like charge) that trails another
  // player. Returns true when it has taken over locomotion for this tick so the
  // normal input-driven movement below is skipped. Any manual movement, combat,
  // or the leader slipping out of range ends the follow.
  stopFollow(p: Entity, msg?: string): void {
    if (p.followTargetId === null) return;
    p.followTargetId = null;
    if (msg) this.error(p.id, msg);
  }

  private updateFollowMovement(p: Entity, meta: PlayerMeta): boolean {
    if (p.followTargetId === null) return false;
    const inp = meta.moveInput;
    // any manual locomotion (incl. camera turns) breaks follow, classic-style
    if (
      inp.forward ||
      inp.back ||
      inp.strafeLeft ||
      inp.strafeRight ||
      inp.jump ||
      inp.turnLeft ||
      inp.turnRight
    ) {
      this.stopFollow(p, 'You stop following.');
      return false;
    }
    const t = this.entities.get(p.followTargetId);
    if (!t || t.dead || t.kind !== 'player' || !this.players.has(t.id)) {
      this.stopFollow(p, 'There is no one to follow.');
      return false;
    }
    if (p.inCombat) {
      this.stopFollow(p, 'You stop following - you are in combat.');
      return false;
    }
    const d = dist2d(p.pos, t.pos);
    if (d > FOLLOW_MAX_RANGE) {
      this.stopFollow(p, `${t.name} is too far away to follow.`);
      return false;
    }
    // always turn to face the leader, even while held in place
    p.facing = angleTo(p.pos, t.pos);
    if (isStunned(p) || isRooted(p) || d <= FOLLOW_STOP_DIST) return true;
    let speed = RUN_SPEED * this.moveSpeedMult(p);
    if (this.isSwimming(p)) speed *= SWIM_SPEED_MULT;
    const step = Math.min(speed * DT, d - FOLLOW_STOP_DIST);
    const nx = p.pos.x + Math.sin(p.facing) * step;
    const nz = p.pos.z + Math.cos(p.facing) * step;
    const h0 = groundHeight(p.pos.x, p.pos.z, this.cfg.seed);
    const h1 = groundHeight(nx, nz, this.cfg.seed);
    if (h1 < WATER_LEVEL - SWIM_DEPTH) return true; // don't trail into deep water
    if (h1 > h0 && step > 1e-5 && (h1 - h0) / step > MAX_CLIMB_SLOPE) return true; // wall/cliff
    const resolved = this.resolveMove(p.pos.x, p.pos.z, nx, nz, BODY_RADIUS, p);
    p.pos.x = resolved.x;
    p.pos.z = resolved.z;
    p.pos.y = groundHeight(resolved.x, resolved.z, this.cfg.seed);
    p.vy = 0;
    p.onGround = true;
    p.fallStartY = p.pos.y;
    return true;
  }

  private updatePlayerMovement(p: Entity, meta: PlayerMeta): void {
    // Any locomotion key counts as a deliberate action for the anti-AFK pet gate.
    const mv = meta.moveInput;
    if (
      mv.forward ||
      mv.back ||
      mv.strafeLeft ||
      mv.strafeRight ||
      mv.turnLeft ||
      mv.turnRight ||
      mv.jump
    ) {
      meta.lastActiveTick = this.tickCount;
    }
    if (this.updateChargeMovement(p)) return;
    if (this.updateFollowMovement(p, meta)) return;
    if (this.updateFearMovement(p)) return;
    const inp = meta.moveInput;
    // Convention: facing f points along (sin f, cos f); the camera sits behind
    // the player, so screen-right is the world vector (-cos f, sin f).
    // Turning right therefore DECREASES facing.
    if (!isStunned(p)) {
      if (inp.turnLeft) p.facing = normAngle(p.facing + TURN_SPEED * DT);
      if (inp.turnRight) p.facing = normAngle(p.facing - TURN_SPEED * DT);
    }

    let mx = 0,
      mz = 0; // local: z forward, x strafe-right
    if (inp.forward) mz += 1;
    if (inp.back) mz -= 1;
    if (inp.strafeLeft) mx -= 1;
    if (inp.strafeRight) mx += 1;

    const wantsMove = mx !== 0 || mz !== 0 || inp.jump;
    if (wantsMove && p.sitting) this.standUp(p);

    const hasMoveInput = mx !== 0 || mz !== 0;
    const moving = hasMoveInput && !isRooted(p);
    const swimming = this.isSwimming(p);
    let wishX = 0,
      wishZ = 0,
      wishSpeed = 0;
    if (moving) {
      if (p.castingAbility) this.cancelCast(p);
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      let speed = RUN_SPEED * this.moveSpeedMult(p);
      if (mz < 0) speed *= BACKPEDAL_MULT;
      if (swimming) speed *= SWIM_SPEED_MULT;
      // world = forward * mz + right * mx, with right = (-cos f, sin f)
      const sin = Math.sin(p.facing),
        cos = Math.cos(p.facing);
      const wx = mz * sin - mx * cos;
      const wz = mz * cos + mx * sin;
      wishX = wx;
      wishZ = wz;
      wishSpeed = speed;
    }

    const movingOnGround = moving && (p.onGround || swimming);
    if (movingOnGround || (!p.onGround && (p.vx !== 0 || p.vz !== 0))) {
      const stepX = movingOnGround ? wishX * wishSpeed : p.vx;
      const stepZ = movingOnGround ? wishZ * wishSpeed : p.vz;
      let nx = p.pos.x + stepX * DT;
      let nz = p.pos.z + stepZ * DT;
      // cliffs and the world rim are walls, not ramps
      if (p.onGround && !swimming) {
        const h0 = groundHeight(p.pos.x, p.pos.z, this.cfg.seed);
        const h1 = groundHeight(nx, nz, this.cfg.seed);
        const run = Math.hypot(nx - p.pos.x, nz - p.pos.z);
        if (h1 > h0 && run > 1e-5 && (h1 - h0) / run > MAX_CLIMB_SLOPE) {
          nx = p.pos.x;
          nz = p.pos.z;
          if (!p.onGround) {
            p.vx = 0;
            p.vz = 0;
          }
        }
      }
      // Slide along buildings, trees, crypt walls — but while airborne from a
      // jump, pass through fences for the whole arc. Keying off the jump itself
      // (not a height threshold) makes this independent of slope: an uphill
      // approach no longer flickers the clearance off right at the rail.
      const clearFences = !p.onGround && p.jumping;
      const resolved = this.resolveMove(p.pos.x, p.pos.z, nx, nz, BODY_RADIUS, p, clearFences);
      p.pos.x = resolved.x;
      p.pos.z = resolved.z;
      if (!p.onGround && (resolved.x !== nx || resolved.z !== nz)) {
        p.vx = (resolved.x - p.prevPos.x) / DT;
        p.vz = (resolved.z - p.prevPos.z) / DT;
      }
    }

    // Vertical: jumping, gravity, swimming, fall damage
    const ground = groundHeight(p.pos.x, p.pos.z, this.cfg.seed);
    const deepWater = ground < WATER_LEVEL - SWIM_DEPTH;
    if (deepWater && p.pos.y <= SWIM_SURFACE_Y + 0.05) {
      // treading water at the surface
      p.pos.y = SWIM_SURFACE_Y;
      p.vy = 0;
      p.vx = 0;
      p.vz = 0;
      p.onGround = true;
      p.jumping = false;
      p.fallStartY = p.pos.y;
      if (inp.jump && !isRooted(p)) {
        // small hop to climb onto shores and docks
        p.vy = JUMP_VELOCITY * 0.7 * this.jumpMult(p);
        p.vx = wishX * wishSpeed;
        p.vz = wishZ * wishSpeed;
        p.onGround = false;
        p.jumping = true;
      }
      return;
    }
    if (inp.jump && p.onGround && !isRooted(p)) {
      p.vy = JUMP_VELOCITY * this.jumpMult(p);
      p.vx = wishX * wishSpeed;
      p.vz = wishZ * wishSpeed;
      p.onGround = false;
      p.jumping = true;
      p.fallStartY = p.pos.y;
    }
    if (!p.onGround) {
      p.vy -= GRAVITY * DT;
      p.pos.y += p.vy * DT;
      p.fallStartY = Math.max(p.fallStartY, p.pos.y);
      if (deepWater && p.pos.y <= SWIM_SURFACE_Y) {
        // splashing into deep water breaks the fall
        p.pos.y = SWIM_SURFACE_Y;
        p.vy = 0;
        p.vx = 0;
        p.vz = 0;
        p.onGround = true;
        p.jumping = false;
        p.fallStartY = p.pos.y;
        return;
      }
      if (p.pos.y <= ground) {
        p.pos.y = ground;
        p.vy = 0;
        p.vx = 0;
        p.vz = 0;
        p.onGround = true;
        p.jumping = false;
        const drop = p.fallStartY - ground;
        if (drop > FALL_SAFE_DISTANCE) {
          const dmg = Math.round(p.maxHp * (drop - FALL_SAFE_DISTANCE) * 0.07);
          if (dmg > 0) this.dealDamage(null, p, dmg, false, 'physical', 'Falling', 'hit', true);
        }
        p.fallStartY = ground;
      }
    } else {
      // Distinguish a walkable downhill slope from a genuine cliff/ledge. The
      // drop the ground can take in one tick scales with how far we moved: a
      // slope no steeper than MAX_CLIMB_SLOPE (the same gate that blocks uphill
      // climbs) is walkable, so we snap down to follow it instead of falling.
      // Only a steeper-than-walkable drop counts as walking off a ledge. The
      // 0.4 base keeps a near-stationary player snapped over tiny terrain noise.
      const run = Math.hypot(p.pos.x - p.prevPos.x, p.pos.z - p.prevPos.z);
      const maxStepDown = 0.4 + run * MAX_CLIMB_SLOPE;
      if (ground < p.pos.y - maxStepDown) {
        // walked off a ledge — not a jump, so fences still block
        p.onGround = false;
        p.jumping = false;
        p.vx = 0;
        p.vz = 0;
        p.vy = 0;
        p.fallStartY = p.pos.y;
      } else {
        p.pos.y = ground;
        p.fallStartY = ground;
      }
    }
  }

  private standUp(p: Entity): void {
    p.sitting = false;
    if (isConsuming(p)) {
      p.eating = null;
      p.drinking = null;
      this.emit({ type: 'log', text: 'You stand up.', color: '#999', pid: p.id });
    }
  }

  // -------------------------------------------------------------------------
  // Regen, timers, auras
  // -------------------------------------------------------------------------

  // updateRegen / updateTimers / cleanseFriendlyNpcAuras / updateAuras moved to
  // combat/auras.ts (C3); the tick() coordinator calls them in their existing per-entity
  // phase (dead players still tick timers/auras). updateAuras keeps its two load-bearing
  // e.dead guards (a DoT tick can kill the target mid-walk) inside the module.
  // updateGroundAoEs (the drain) moved to entity_roster.ts (tickGroundAoEs); it pulses
  // through this.ctx.pulseGroundAoE. pulseGroundAoE STAYS here (shared entry point,
  // also called on-cast from the effect path).
  private pulseGroundAoE(effect: GroundAoE, threatOpts?: { flat?: number; mult?: number }): void {
    const source = this.entities.get(effect.sourceId);
    if (!source || source.dead) return;
    this.emit({
      type: 'spellfx',
      sourceId: source.id,
      targetId: source.id,
      school: effect.school,
      fx: 'tick',
    });
    for (const target of this.hostilesInRadius(source, effect.pos, effect.radius)) {
      if (!this.hasLineOfSight(source, target)) continue;
      const dmg = Math.round(this.rng.range(effect.min, effect.max));
      this.dealDamage(
        source,
        target,
        dmg,
        false,
        effect.school,
        effect.ability,
        'hit',
        false,
        threatOpts,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Casting, channeling & abilities
  // -------------------------------------------------------------------------

  // Casting lifecycle (cast start/progress/finish, GCD, resource+cost+talent mods,
  // cooldown arming) moved to src/sim/combat/casting_lifecycle.ts (C4a). These stay
  // as thin delegates so the tick() updateCasting call, the public castAbility /
  // castAbilityBySlot entry points (server/game.ts, hud.ts, obs.ts, tests), the
  // dealDamage spell-pushback arms (cancelCast/pushbackCast via the SimContext seam),
  // the despawn/demon-channel cancelCast callers, and the demon-heal/queued-swing
  // spendResource callers all resolve unchanged. runEffects STAYS on Sim (C4b); the
  // moved module reaches it (and every other helper) only through SimContext.
  private updateCasting(p: Entity, meta: PlayerMeta): void {
    updateCastingImpl(this.ctx, p, meta);
  }

  private cancelCast(p: Entity): void {
    cancelCastImpl(this.ctx, p);
  }

  private abilityNeedsLineOfSight(ability: AbilityDef): boolean {
    if (!ability.requiresTarget) return false;
    return ability.school !== 'physical' || ability.range > MELEE_RANGE;
  }

  private hasLineOfSight(source: Entity, target: Entity): boolean {
    return lineOfSightClear(this.cfg.seed, source.pos, target.pos);
  }

  private lineOfSightBlocked(source: Entity, target: Entity, ability: AbilityDef): boolean {
    return this.abilityNeedsLineOfSight(ability) && !this.hasLineOfSight(source, target);
  }

  private pushbackCast(p: Entity): void {
    pushbackCastImpl(p);
  }

  castAbilityBySlot(slot: number, pid?: number): void {
    castAbilityBySlotImpl(this.ctx, slot, pid);
  }

  castAbility(abilityId: string, pid?: number): void {
    castAbilityImpl(this.ctx, abilityId, pid);
  }

  private spendResource(p: Entity, cost: number): void {
    spendResourceImpl(p, cost);
  }

  private spellCrit(p: Entity): number {
    return 0.05 + p.stats.int * 0.0008;
  }

  // Heal core, heal multipliers, heal-absorb soak, crit-vuln bonus, and the
  // healing-threat fan-out moved to src/sim/combat/heal.ts (C2). These stay as thin
  // delegates so the foreign `this.X` callers (aura `hot` tick, regen/potion heal,
  // the heal ability effect, mob mendAlly, and dealDamage's hex/crit-vuln reads via
  // the seam) plus the existing `(sim as any).X` unit tests resolve unchanged.
  // threatEntryMatchesEntity moved too; it had no caller outside healingThreat, so it
  // is module-private there with no Sim delegate.
  private healingTakenMult(target: Entity): number {
    return healingTakenMultImpl(this.ctx, target);
  }

  private hexOutputMult(source: Entity | null): number {
    return hexOutputMultImpl(this.ctx, source);
  }

  private consumeHealAbsorb(target: Entity, healed: number): number {
    return consumeHealAbsorbImpl(this.ctx, target, healed);
  }

  private critVulnBonus(target: Entity): number {
    return critVulnBonusImpl(this.ctx, target);
  }

  private applyHeal(source: Entity, target: Entity, amount: number, ability: string): void {
    applyHealImpl(this.ctx, source, target, amount, ability);
  }

  private healingThreat(source: Entity, target: Entity, healed: number): void {
    healingThreatImpl(this.ctx, source, target, healed);
  }

  private runEffects(
    p: Entity,
    meta: PlayerMeta,
    target: Entity | null,
    res: ResolvedAbility,
  ): void {
    const ability = res.def;
    const isSpell = ability.school !== 'physical';
    const spentCombo = ability.spendsCombo ? p.comboPoints : 0;
    let comboAwarded = false;
    // acting breaks stealth (the opener itself still lands first inside the swing).
    // Stealth toggles and Rogue Sprint are allowed while remaining hidden.
    if (!preservesStealth(ability)) this.breakStealth(p);
    const threatOpts = { flat: res.threatFlat, mult: res.threatMult };

    for (const eff of res.effects) {
      switch (eff.type) {
        case 'weaponStrike': {
          if (!target) break;
          const hit = this.meleeSwing(p, target, eff.bonus, ability.name, {
            cannotBeDodged: eff.cannotBeDodged,
            weaponMult: eff.weaponMult ?? 1,
            threatFlat: res.threatFlat,
            threatMult: res.threatMult,
          });
          if (hit && ability.awardsCombo) {
            this.awardCombo(p, target, ability.awardsCombo);
            comboAwarded = true;
          }
          if (ability.requiresDodgeProc) p.overpowerUntil = -1;
          break;
        }
        case 'directDamage': {
          if (!target) break;
          const critChance = isSpell ? this.spellCrit(p) : p.critChance;
          let dmg = this.rng.range(eff.min, eff.max);
          const crit = this.rng.chance(critChance);
          if (crit) dmg *= isSpell ? 1.5 : 2;
          if (!isSpell) dmg *= 1 - armorReduction(this.effectiveArmor(target), p.level);
          this.dealDamage(
            p,
            target,
            Math.round(dmg),
            crit,
            ability.school,
            ability.name,
            'hit',
            false,
            threatOpts,
          );
          if (!target.dead && ability.awardsCombo && !comboAwarded) {
            this.awardCombo(p, target, ability.awardsCombo);
            comboAwarded = true;
          }
          break;
        }
        case 'finisherDamage': {
          if (!target || spentCombo <= 0) break;
          let dmg =
            eff.base +
            eff.perCombo * spentCombo +
            this.rng.range(0, eff.variance) +
            this.effectiveAttackPower(p) / 14;
          const crit = this.rng.chance(p.critChance);
          if (crit) dmg *= 2;
          dmg *= 1 - armorReduction(this.effectiveArmor(target), p.level);
          this.dealDamage(
            p,
            target,
            Math.round(dmg),
            crit,
            'physical',
            ability.name,
            'hit',
            false,
            threatOpts,
          );
          break;
        }
        case 'finisherHaste': {
          if (spentCombo <= 0) break;
          this.applyAura(p, {
            id: ability.id,
            name: ability.name,
            kind: 'buff_haste',
            remaining: eff.basedur + eff.perCombo * spentCombo,
            duration: eff.basedur + eff.perCombo * spentCombo,
            value: eff.mult,
            sourceId: p.id,
            school: 'physical',
          });
          break;
        }
        case 'finisherStun': {
          if (!target || target.dead || spentCombo <= 0) break;
          const dur = eff.base + eff.perCombo * spentCombo;
          this.applyAura(target, {
            id: `${ability.id}_stun`,
            name: ability.name,
            kind: 'stun',
            remaining: dur,
            duration: dur,
            value: 0,
            sourceId: p.id,
            school: ability.school,
          });
          this.enterCombat(p, target);
          break;
        }
        case 'weaponDamage':
          break;
        case 'heal': {
          const healTarget = target ?? p;
          this.applyHeal(p, healTarget, this.rng.range(eff.min, eff.max), ability.name);
          break;
        }
        case 'hot': {
          const hotTarget = target ?? p;
          this.applyAura(hotTarget, {
            id: ability.id,
            name: ability.name,
            kind: 'hot',
            remaining: eff.duration,
            duration: eff.duration,
            value: Math.max(1, Math.round(eff.total / (eff.duration / eff.interval))),
            tickInterval: eff.interval,
            tickTimer: eff.interval,
            sourceId: p.id,
            school: ability.school,
          });
          break;
        }
        case 'absorb': {
          const shieldTarget = target ?? p;
          this.applyAura(shieldTarget, {
            id: ability.id,
            name: ability.name,
            kind: 'absorb',
            remaining: eff.duration,
            duration: eff.duration,
            value: eff.amount,
            sourceId: p.id,
            school: ability.school,
          });
          break;
        }
        case 'imbue': {
          for (let i = p.auras.length - 1; i >= 0; i--) {
            const a = p.auras[i];
            if (a.kind === 'imbue' && a.id !== ability.id) {
              p.auras.splice(i, 1);
              this.emit({ type: 'aura', targetId: p.id, name: a.name, gained: false });
            }
          }
          this.applyAura(p, {
            id: ability.id,
            name: ability.name,
            kind: 'imbue',
            remaining: eff.duration,
            duration: eff.duration,
            value: eff.bonus,
            value2: eff.judgeMin,
            value3: eff.judgeMax,
            sourceId: p.id,
            school: ability.school,
          });
          break;
        }
        case 'judgement': {
          if (!target) break;
          const sealIdx = p.auras.findIndex((a) => a.kind === 'imbue' && a.value2 !== undefined);
          if (sealIdx < 0) {
            this.error(p.id, 'You have no active Seal.');
            break;
          }
          const seal = p.auras[sealIdx];
          p.auras.splice(sealIdx, 1);
          this.emit({ type: 'aura', targetId: p.id, name: seal.name, gained: false });
          let dmg = this.rng.range(seal.value2 ?? 10, seal.value3 ?? 15);
          const crit = this.rng.chance(this.spellCrit(p));
          if (crit) dmg *= 1.5;
          this.dealDamage(p, target, Math.round(dmg), crit, 'holy', ability.name, 'hit');
          break;
        }
        case 'lifeTap': {
          if (p.hp <= eff.hp) {
            this.error(p.id, 'Not enough health.');
            break;
          }
          p.hp -= eff.hp;
          this.emit({
            type: 'damage',
            sourceId: p.id,
            targetId: p.id,
            amount: eff.hp,
            crit: false,
            school: 'shadow',
            ability: ability.name,
            kind: 'hit',
          });
          p.resource = Math.min(p.maxResource, p.resource + eff.mana);
          break;
        }
        case 'drainTick':
          break; // handled per channel tick
        case 'buffTarget': {
          const buffTarget = target ?? p;
          this.applyAura(buffTarget, {
            id: ability.id,
            name: ability.name,
            kind: eff.kind,
            remaining: eff.duration,
            duration: eff.duration,
            value: eff.value,
            sourceId: p.id,
            school: ability.school,
          });
          break;
        }
        case 'dot': {
          if (!target || target.dead) break;
          this.applyAura(target, {
            id: ability.id,
            name: ability.name,
            kind: 'dot',
            remaining: eff.duration,
            duration: eff.duration,
            value: Math.max(1, Math.round(eff.total / (eff.duration / eff.interval))),
            tickInterval: eff.interval,
            tickTimer: eff.interval,
            sourceId: p.id,
            school: ability.school,
          });
          this.enterCombat(p, target);
          break;
        }
        case 'slow': {
          if (!target || target.dead) break;
          this.applyAura(target, {
            id: `${ability.id}_slow`,
            name: ability.name,
            kind: 'slow',
            remaining: eff.duration,
            duration: eff.duration,
            value: eff.mult,
            sourceId: p.id,
            school: ability.school,
          });
          this.enterCombat(p, target);
          break;
        }
        case 'root': {
          if (!target || target.dead) break;
          this.applyRootAura(
            p,
            target,
            ability.name,
            `${ability.id}_root`,
            eff.duration,
            ability.school,
          );
          this.enterCombat(p, target);
          break;
        }
        case 'stun': {
          if (!target || target.dead) break;
          this.applyAura(target, {
            id: `${ability.id}_stun`,
            name: ability.name,
            kind: 'stun',
            remaining: eff.duration,
            duration: eff.duration,
            value: 0,
            sourceId: p.id,
            school: ability.school,
          });
          this.enterCombat(p, target);
          break;
        }
        case 'incapacitate': {
          if (!target || target.dead) break;
          const remaining =
            ability.id === 'fear'
              ? this.diminishedCrowdControlDuration(p, target, 'fear', eff.duration)
              : eff.duration;
          if (remaining === null) break;
          this.applyAura(target, {
            id: `${ability.id}_incap`,
            name: ability.name,
            kind: 'incapacitate',
            remaining,
            duration: remaining,
            value: ability.id === 'fear' ? this.rng.range(-Math.PI, Math.PI) : 0,
            sourceId: p.id,
            school: ability.school,
            breaksOnDamage: true,
          });
          if (ability.awardsCombo && !comboAwarded) {
            this.awardCombo(p, target, ability.awardsCombo);
            comboAwarded = true;
          }
          this.enterCombat(p, target);
          break;
        }
        case 'polymorph': {
          if (!target || target.dead) break;
          const remaining = this.diminishedCrowdControlDuration(
            p,
            target,
            'polymorph',
            eff.duration,
          );
          if (remaining === null) break;
          target.hp = target.maxHp;
          this.applyAura(target, {
            id: ability.id,
            name: ability.name,
            kind: 'polymorph',
            remaining,
            duration: remaining,
            value: 0,
            tickInterval: 1,
            tickTimer: 1,
            sourceId: p.id,
            school: ability.school,
            breaksOnDamage: true,
          });
          target.auras = target.auras.filter((a) => a.kind !== 'dot' || a.id === ability.id);
          this.enterCombat(p, target);
          break;
        }
        case 'aoeDamage': {
          this.emit({
            type: 'spellfx',
            sourceId: p.id,
            targetId: p.id,
            school: ability.school,
            fx: 'nova',
          });
          for (const m of this.hostilesInRadius(p, p.pos, eff.radius)) {
            if (!this.hasLineOfSight(p, m)) continue;
            let dmg = this.rng.range(eff.min, eff.max);
            // Armor only mitigates physical damage, mirroring the single-target
            // path above — spell-school AoE (Arcane Explosion, Consecration) is
            // not reduced by the target's armor.
            if (!isSpell) dmg *= 1 - armorReduction(this.effectiveArmor(m), p.level);
            this.dealDamage(
              p,
              m,
              Math.round(dmg),
              false,
              ability.school,
              ability.name,
              'hit',
              false,
              threatOpts,
            );
          }
          break;
        }
        case 'groundAoE': {
          const groundEffect: GroundAoE = {
            sourceId: p.id,
            pos: { ...p.pos },
            radius: eff.radius,
            min: eff.min,
            max: eff.max,
            remaining: eff.duration,
            interval: eff.interval,
            tickTimer: eff.interval,
            school: ability.school,
            ability: ability.name,
          };
          this.emit({
            type: 'spellfx',
            sourceId: p.id,
            targetId: p.id,
            school: ability.school,
            fx: 'nova',
          });
          this.pulseGroundAoE(groundEffect, threatOpts);
          this.groundAoEs.push(groundEffect);
          break;
        }
        case 'aoeAttackSpeed': {
          for (const m of this.hostilesInRadius(p, p.pos, eff.radius)) {
            if (m.dead) continue;
            if (!this.hasLineOfSight(p, m)) continue;
            this.applyAura(m, {
              id: `${ability.id}_as`,
              name: ability.name,
              kind: 'attackspeed',
              remaining: eff.duration,
              duration: eff.duration,
              value: eff.mult,
              sourceId: p.id,
              school: ability.school,
            });
          }
          break;
        }
        case 'aoeAttackPower': {
          for (const m of this.hostilesInRadius(p, p.pos, eff.radius)) {
            if (m.dead) continue;
            this.applyAura(m, {
              id: `${ability.id}_ap`,
              name: ability.name,
              kind: 'debuff_ap',
              remaining: eff.duration,
              duration: eff.duration,
              value: eff.amount,
              sourceId: p.id,
              school: ability.school,
            });
            this.enterCombat(p, m);
            if (m.kind === 'mob' && m.hostile)
              addThreat(m, p.id, 10 * this.threatMod(p, ability.school));
          }
          break;
        }
        case 'aoeRoot': {
          this.emit({
            type: 'spellfx',
            sourceId: p.id,
            targetId: p.id,
            school: ability.school,
            fx: 'nova',
          });
          for (const m of this.hostilesInRadius(p, p.pos, eff.radius)) {
            if (!this.hasLineOfSight(p, m)) continue;
            const dmg = this.rng.range(eff.min, eff.max);
            this.dealDamage(p, m, Math.round(dmg), false, ability.school, ability.name, 'hit');
            if (!m.dead && this.isHostileTo(p, m)) {
              this.applyRootAura(
                p,
                m,
                ability.name,
                `${ability.id}_root`,
                eff.duration,
                ability.school,
              );
            }
          }
          break;
        }
        case 'selfBuff': {
          // forms, stances and stealth are toggles: casting again cancels
          const isFormKind =
            eff.kind === 'form_bear' || eff.kind === 'form_cat' || eff.kind === 'form_travel';
          const isToggle =
            isFormKind ||
            eff.kind === 'defensive_stance' ||
            eff.kind === 'stealth' ||
            ability.id === 'ghost_wolf';
          if (isToggle) {
            const existing = p.auras.findIndex((a) => a.id === ability.id);
            if (existing >= 0) {
              p.auras.splice(existing, 1);
              this.emit({ type: 'aura', targetId: p.id, name: ability.name, gained: false });
              recalcPlayerStats(p, meta.cls, meta.equipment, this.playerMods(meta));
              break;
            }
          }
          // shapeshifting out of one form into another (bear/cat/travel are exclusive)
          if (isFormKind) {
            for (let i = p.auras.length - 1; i >= 0; i--) {
              const a = p.auras[i];
              if (
                (a.kind === 'form_bear' || a.kind === 'form_cat' || a.kind === 'form_travel') &&
                a.kind !== eff.kind
              ) {
                p.auras.splice(i, 1);
                this.emit({ type: 'aura', targetId: p.id, name: a.name, gained: false });
              }
            }
          }
          this.applyAura(p, {
            id: ability.id,
            name: ability.name,
            kind: eff.kind,
            remaining: eff.duration,
            duration: eff.duration,
            value: eff.value,
            sourceId: p.id,
            school: ability.school,
          });
          recalcPlayerStats(p, meta.cls, meta.equipment, this.playerMods(meta));
          break;
        }
        case 'gainResource': {
          p.resource = Math.min(p.maxResource, p.resource + eff.amount);
          break;
        }
        case 'selfDamagePctMax': {
          const dmg = Math.round(p.maxHp * eff.pct);
          p.hp = Math.max(1, p.hp - dmg);
          this.emit({
            type: 'damage',
            sourceId: p.id,
            targetId: p.id,
            amount: dmg,
            crit: false,
            school: 'physical',
            ability: ability.name,
            kind: 'hit',
          });
          break;
        }
        case 'charge': {
          if (!target) break;
          // the stun effect in the same ability lands this tick; the player
          // then runs the route at charge speed instead of teleporting
          p.chargeTargetId = target.id;
          p.chargeTimeLeft = CHARGE_MAX_DURATION;
          p.chargePath = this.findChargePath(p, target);
          if (p.resourceType === 'rage') p.resource = Math.min(p.maxResource, p.resource + 9);
          this.enterCombat(p, target);
          break;
        }
        case 'sunder': {
          if (!target || target.dead) break;
          // a sunder can miss like any melee attack — a miss causes no threat
          if (this.rng.chance(meleeMissChance(p.level, target.level))) {
            this.emit({
              type: 'damage',
              sourceId: p.id,
              targetId: target.id,
              amount: 0,
              crit: false,
              school: 'physical',
              ability: ability.name,
              kind: 'miss',
            });
            this.enterCombat(p, target);
            break;
          }
          const existing = target.auras.find((a) => a.kind === 'sunder');
          if (existing) {
            existing.stacks = Math.min(eff.maxStacks, (existing.stacks ?? 1) + 1);
            existing.value = eff.armor;
            existing.remaining = existing.duration;
            this.emit({ type: 'aura', targetId: target.id, name: ability.name, gained: true });
          } else {
            this.applyAura(target, {
              id: ability.id,
              name: ability.name,
              kind: 'sunder',
              remaining: 30,
              duration: 30,
              value: eff.armor,
              stacks: 1,
              sourceId: p.id,
              school: 'physical',
            });
          }
          // sunder deals no damage: its threat is the flat value, stance-scaled
          addThreat(target, p.id, res.threatFlat * this.threatMod(p, 'physical'));
          this.enterCombat(p, target);
          break;
        }
        case 'taunt': {
          if (target?.kind !== 'mob' || target.dead) break;
          this.applyTaunt(p, target);
          break;
        }
        case 'tamePet': {
          if (target) this.completeTame(p, target);
          break;
        }
        case 'summonPet': {
          this.summonPet(p, eff.templateId);
          break;
        }
        case 'dismissPet': {
          const pet = this.petOf(p.id);
          if (!pet) {
            this.error(p.id, 'You have no pet.');
            break;
          }
          this.error(p.id, 'Permanent pets can only be abandoned from the pet frame.');
          break;
        }
        case 'summonDemon': {
          this.summonPet(p, eff.mobId);
          break;
        }
      }
      if (target?.dead) target = null;
    }

    if (ability.spendsCombo && spentCombo > 0) {
      p.comboPoints = 0;
      this.emit({ type: 'comboPoint', points: 0, pid: p.id });
    }
  }

  private awardCombo(p: Entity, target: Entity, points: number): void {
    if (p.comboTargetId !== target.id) {
      p.comboPoints = 0;
      p.comboTargetId = target.id;
    }
    p.comboPoints = Math.min(5, p.comboPoints + points);
    this.emit({ type: 'comboPoint', points: p.comboPoints, pid: p.id });
  }

  private applyAura(target: Entity, aura: Aura): void {
    if (target.kind === 'npc' && isRejectedFriendlyNpcAura(aura)) return;
    if (
      this.isNythraxisRaidEnemy(target) &&
      this.isNythraxisControlAura(aura.kind) &&
      aura.sourceId !== target.id &&
      !this.isNythraxisScriptedControl(target, aura)
    )
      return;
    if (
      target.kind === 'mob' &&
      MOBS[target.templateId]?.ccImmune &&
      this.isControlAura(aura.kind) &&
      aura.sourceId !== target.id &&
      !this.isNythraxisScriptedControl(target, aura)
    )
      return;
    const existing = target.auras.findIndex(
      (a) => a.id === aura.id && a.sourceId === aura.sourceId,
    );
    if (existing >= 0) {
      this.applyNonPlayerStatAura(target, target.auras[existing], -1);
      target.auras.splice(existing, 1);
    }
    target.auras.push(aura);
    this.applyNonPlayerStatAura(target, aura, 1);
    this.emit({ type: 'aura', targetId: target.id, name: aura.name, gained: true });
    const source = this.entities.get(aura.sourceId);
    this.refreshMobLeashFromAction(source ?? null, target);
    if (target.kind === 'player') {
      const meta = this.players.get(target.id);
      if (meta) recalcPlayerStats(target, meta.cls, meta.equipment, this.playerMods(meta));
    }
  }

  private applyRootAura(
    source: Entity,
    target: Entity,
    name: string,
    id: string,
    duration: number,
    school: Aura['school'],
  ): void {
    const remaining = this.diminishedCrowdControlDuration(source, target, 'root', duration);
    if (remaining === null) return;
    this.applyAura(target, {
      id,
      name,
      kind: 'root',
      remaining,
      duration: remaining,
      value: 0,
      sourceId: source.id,
      school,
    });
  }

  // On-hit knockback: hurl `target` up to `distance` yards straight away from
  // `source`. Instantaneous displacement (no aura) walked in small steps so it can
  // be terrain-clamped exactly like a warrior charge — the shove stops at the last
  // safe footing before deep water or a cliff rather than stranding the victim off
  // the world. Returns the yards actually moved (0 if blocked immediately).
  private applyKnockback(source: Entity, target: Entity, distance: number): number {
    let dx = target.pos.x - source.pos.x;
    let dz = target.pos.z - source.pos.z;
    let len = Math.hypot(dx, dz);
    if (len < 1e-4) {
      // exactly overlapping: shove along the mob's facing so the direction is stable
      dx = Math.sin(source.facing);
      dz = Math.cos(source.facing);
      len = 1;
    }
    const ux = dx / len,
      uz = dz / len;
    const STEP = 0.5;
    let moved = 0;
    let cx = target.pos.x,
      cz = target.pos.z;
    while (moved < distance) {
      const adv = Math.min(STEP, distance - moved);
      const nx = cx + ux * adv,
        nz = cz + uz * adv;
      const h0 = groundHeight(cx, cz, this.cfg.seed);
      const h1 = groundHeight(nx, nz, this.cfg.seed);
      if (h1 < WATER_LEVEL - SWIM_DEPTH) break; // would land in deep water
      if (h1 > h0 && (h1 - h0) / adv > MAX_CLIMB_SLOPE) break; // would slam into a cliff
      cx = nx;
      cz = nz;
      moved += adv;
    }
    if (moved <= 0) return 0;
    // resolveMovePoint is a no-op wrapper over resolvePosition outside a delve, and
    // applies the run's module colliders + portcullis doors when target is inside one.
    const resolved = this.resolveMovePoint(cx, cz, BODY_RADIUS, target);
    target.pos.x = resolved.x;
    target.pos.z = resolved.z;
    target.pos.y = groundHeight(resolved.x, resolved.z, this.cfg.seed);
    target.vy = 0;
    target.onGround = true;
    target.fallStartY = target.pos.y;
    return moved;
  }

  private diminishedCrowdControlDuration(
    source: Entity,
    target: Entity,
    category: CrowdControlDrCategory,
    duration: number,
  ): number | null {
    if (source.kind !== 'player' || target.kind !== 'player' || !this.isHostileTo(source, target)) {
      return duration;
    }
    const existing = target.ccDr.get(category);
    const stage = existing && existing.resetAt > this.time ? existing.stage : 0;
    const reset =
      category === 'polymorph'
        ? PVP_POLYMORPH_DR_RESET
        : category === 'fear'
          ? PVP_FEAR_DR_RESET
          : PVP_ROOT_DR_RESET;
    if (category === 'polymorph') {
      target.ccDr.set(category, { stage: stage + 1, resetAt: this.time + reset });
      return PVP_POLYMORPH_DR_DURATIONS[Math.min(stage, PVP_POLYMORPH_DR_DURATIONS.length - 1)];
    }
    if (category === 'fear') {
      target.ccDr.set(category, { stage: stage + 1, resetAt: this.time + reset });
      return PVP_FEAR_DR_DURATIONS[Math.min(stage, PVP_FEAR_DR_DURATIONS.length - 1)];
    }
    if (stage >= PVP_CC_DR_MULTIPLIERS.length) return null;
    target.ccDr.set(category, { stage: stage + 1, resetAt: this.time + reset });
    return duration * PVP_CC_DR_MULTIPLIERS[stage];
  }

  private hostilesInRadius(source: Entity, pos: Vec3, radius: number): Entity[] {
    const out: Entity[] = [];
    this.grid.forEachInRadius(pos.x, pos.z, radius, (e) => {
      if (e.id !== source.id && !e.dead && this.isHostileTo(source, e)) out.push(e);
    });
    return out;
  }

  private breakStealth(e: Entity): void {
    const idx = e.auras.findIndex((a) => a.kind === 'stealth');
    if (idx < 0) return;
    const name = e.auras[idx].name;
    e.auras.splice(idx, 1);
    this.emit({ type: 'aura', targetId: e.id, name, gained: false });
  }

  private breakGhostWolf(e: Entity): void {
    const idx = e.auras.findIndex((a) => a.id === 'ghost_wolf');
    if (idx < 0) return;
    const name = e.auras[idx].name;
    e.auras.splice(idx, 1);
    this.emit({ type: 'aura', targetId: e.id, name, gained: false });
  }

  // Taunt/Growl, classic semantics: never misses, lifts the caster's threat to
  // the top of the table, and forces the mob onto the caster for 3 seconds.
  private applyTaunt(p: Entity, mob: Entity): void {
    const top = topThreatValue(mob);
    const mine = mob.threat.get(p.id) ?? 0;
    mob.threat.set(p.id, Math.max(mine, top, 1));
    if (p.ownerId !== null && MOBS[mob.templateId]?.boss) {
      this.enterCombat(p, mob);
      return;
    }
    mob.forcedTargetId = p.id;
    mob.forcedTargetTimer = TAUNT_FORCE_SECONDS;
    if (mob.aiState === 'idle') this.aggroMob(mob, p, false);
    else if (mob.aiState === 'chase' || mob.aiState === 'attack') mob.aggroTargetId = p.id;
    else if (mob.aiState === 'flee') {
      mob.aggroTargetId = p.id;
      mob.aiState = 'attack';
      mob.fleeTimer = 0;
      mob.fleeReturnTimer = 0;
    }
    this.enterCombat(p, mob);
  }

  // -------------------------------------------------------------------------
  // Hunter pets
  // -------------------------------------------------------------------------

  petOf(ownerPid: number, includeDead = false): Entity | null {
    for (const e of this.entities.values()) {
      if (
        e.kind === 'mob' &&
        e.ownerId === ownerPid &&
        !this.isDelveCompanionMob(e) &&
        (includeDead || !e.dead)
      )
        return e;
    }
    return null;
  }

  private serializePet(ownerPid: number): PetState | null {
    const pet = this.petOf(ownerPid, true);
    // While the owner is inside a delve their pet is despawned and parked in
    // delvePetStash (stowPetForDelve). It has no live entity, so fall back to the
    // stashed snapshot, otherwise a save taken mid-delve (autosave, disconnect, or
    // shutdown saveAll) would persist pet:null and lose the pet on reload.
    if (!pet) return this.delvePetStash.get(ownerPid) ?? null;
    return {
      templateId: pet.templateId,
      name: pet.name,
      level: pet.level,
      hp: pet.dead ? 0 : Math.max(1, Math.min(pet.maxHp, pet.hp)),
      dead: pet.dead,
      mode: pet.petMode,
      autoTaunt: pet.petAutoTaunt,
    };
  }

  private restorePet(owner: Entity, state: PetState): void {
    const template = MOBS[state.templateId];
    if (!template) return;
    const level = owner.level;
    const pos = this.groundPos(owner.pos.x + 2, owner.pos.z + 1);
    const pet = createMob(this.nextId++, template, level, pos);
    pet.name = this.cleanPetName(state.name) ?? template.name;
    pet.ownerId = owner.id;
    pet.petMode = state.mode ?? 'defensive';
    pet.petTauntTimer = 0;
    pet.petAutoTaunt = state.autoTaunt ?? false;
    pet.petManualTauntPending = false;
    pet.hostile = false;
    pet.aiState = state.dead ? 'dead' : 'idle';
    pet.aggroTargetId = null;
    pet.inCombat = false;
    pet.tappedById = null;
    pet.loot = null;
    pet.lootable = false;
    pet.wanderTarget = null;
    clearThreat(pet);
    if (state.dead) {
      pet.dead = true;
      pet.hp = 0;
      pet.corpseTimer = Infinity;
      pet.respawnTimer = Infinity;
    } else {
      pet.hp = Math.max(1, Math.min(pet.maxHp, Math.round(state.hp) || pet.maxHp));
    }
    this.addEntity(pet);
  }

  private syncPetLevel(owner: Entity): void {
    const pet = this.petOf(owner.id, true);
    if (!pet || pet.level === owner.level) return;
    const template = MOBS[pet.templateId];
    if (!template) return;
    const hpFrac = pet.maxHp > 0 ? pet.hp / pet.maxHp : 1;
    const scaled = createMob(-1, template, owner.level, pet.pos);
    pet.level = scaled.level;
    pet.maxHp = scaled.maxHp;
    pet.weapon = scaled.weapon;
    pet.stats.armor = scaled.stats.armor;
    pet.moveSpeed = scaled.moveSpeed;
    pet.scale = scaled.scale;
    pet.color = scaled.color;
    pet.hp = pet.dead ? 0 : Math.max(1, Math.min(pet.maxHp, Math.round(pet.maxHp * hpFrac)));
  }

  private cleanPetName(raw: string): string | null {
    const name = raw.trim().replace(/\s+/g, ' ');
    return PET_NAME_RE.test(name) ? name : null;
  }

  private tameError(p: Entity, target: Entity): string | null {
    if (target.kind !== 'mob' || !target.hostile) return 'You cannot tame that.';
    const template = MOBS[target.templateId];
    if (!template || (template.family !== 'beast' && template.family !== 'spider'))
      return 'Only beasts can be tamed.';
    if (template.elite || template.boss || template.rare)
      return 'That beast is too strong to tame.';
    if (target.level > p.level) return 'That beast is too high level for you to tame.';
    if (target.spawnPos.x > DUNGEON_X_THRESHOLD) return 'You cannot tame dungeon creatures.';
    if (this.petOf(p.id, true)) return 'You already have a pet.';
    return null;
  }

  private completeTame(p: Entity, target: Entity): void {
    const err = this.tameError(p, target);
    if (err) {
      this.error(p.id, err);
      return;
    }
    const template = MOBS[target.templateId];
    const pet = createMob(
      this.nextId++,
      template,
      target.level,
      this.groundPos(p.pos.x + 2, p.pos.z + 1),
    );
    pet.name = target.name;
    pet.ownerId = p.id;
    pet.petMode = 'defensive';
    pet.petTauntTimer = 0;
    pet.petAutoTaunt = false;
    pet.petManualTauntPending = false;
    pet.hostile = false;
    pet.aiState = 'idle';
    pet.aggroTargetId = null;
    pet.inCombat = false;
    pet.tappedById = null;
    pet.auras = [];
    pet.hp = pet.maxHp;
    pet.loot = null;
    pet.lootable = false;
    pet.wanderTarget = null;
    clearThreat(pet);

    this.pendingMobRespawns.push({
      templateId: target.templateId,
      level: target.level,
      pos: { ...target.spawnPos },
      facing: target.facing,
      dungeonId: target.dungeonId,
      timer: TAMED_TARGET_RESPAWN_SECONDS,
    });
    this.clearEntityMarker(target.id);
    this.dropEntity(target.id);

    // The owned copy is friendly now: nobody keeps swinging at the old target,
    // other mobs forget both the old entity and the new pet starts clean.
    for (const other of this.players.values()) {
      const e = this.entities.get(other.entityId);
      if (e && e.targetId === target.id) e.autoAttack = false;
    }
    for (const m of this.entities.values()) {
      if (m.kind !== 'mob') continue;
      m.threat.delete(target.id);
      if (m.aggroTargetId === target.id && !m.dead && m.aiState !== 'dead') this.retargetMob(m);
    }
    this.addEntity(pet);
    this.syncPetLevel(p);
    this.emit({
      type: 'log',
      text: `${pet.name} is now your loyal companion.`,
      color: '#8f8',
      pid: p.id,
    });
    this.emit({ type: 'aura', targetId: pet.id, name: 'Tamed', gained: true });
  }

  private summonPet(owner: Entity, templateId: string): void {
    const template = MOBS[templateId];
    if (!template) {
      this.error(owner.id, 'That summon is unavailable.');
      return;
    }
    const existing = this.petOf(owner.id, true);
    if (existing) {
      this.despawnPersistentPet(existing);
      if (existing.templateId === templateId && !existing.dead) {
        this.emit({
          type: 'log',
          text: `${existing.name} fades back into the void.`,
          color: '#b894ff',
          pid: owner.id,
        });
        return;
      }
    }

    const pet = this.createDemonPet(owner, templateId);
    if (!pet) return;
    this.emit({
      type: 'log',
      text: `${pet.name} answers your summons.`,
      color: '#b894ff',
      pid: owner.id,
    });
    this.emit({ type: 'aura', targetId: pet.id, name: 'Summoned', gained: true });
  }

  private createDemonPet(owner: Entity, mobId: string, emit = false): Entity | null {
    const template = MOBS[mobId];
    if (!template) return null;
    const pet = createMob(
      this.nextId++,
      template,
      owner.level,
      this.groundPos(owner.pos.x + 2, owner.pos.z + 1),
    );
    pet.name = template.name;
    pet.ownerId = owner.id;
    pet.petMode = 'defensive';
    pet.petTauntTimer = 0;
    pet.petAutoTaunt = false;
    pet.petManualTauntPending = false;
    pet.hostile = false;
    pet.aiState = 'idle';
    pet.aggroTargetId = null;
    pet.inCombat = false;
    pet.tappedById = null;
    pet.auras = [];
    pet.hp = pet.maxHp;
    pet.loot = null;
    pet.lootable = false;
    pet.wanderTarget = null;
    clearThreat(pet);
    this.addEntity(pet);
    if (emit)
      this.emit({
        type: 'log',
        text: `${pet.name} answers your summons.`,
        color: '#b894ff',
        pid: owner.id,
      });
    return pet;
  }

  private despawnPersistentPet(pet: Entity): void {
    this.clearNonPlayerStatAuras(pet);
    pet.auras = [];
    clearThreat(pet);
    for (const m of this.entities.values()) {
      if (m.kind !== 'mob' || m.id === pet.id) continue;
      m.threat.delete(pet.id);
      if (m.aggroTargetId === pet.id && !m.dead && m.aiState !== 'dead') this.retargetMob(m);
    }
    this.dropEntity(pet.id);
  }

  abandonPet(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    if (r.meta.cls !== 'hunter') {
      this.error(r.e.id, 'Only hunters can abandon pets.');
      return;
    }
    const pet = this.petOf(r.e.id, true);
    if (!pet) {
      this.error(r.e.id, 'You have no pet.');
      return;
    }
    this.emit({ type: 'log', text: `You abandon ${pet.name}.`, color: '#f66', pid: r.e.id });
    this.despawnPersistentPet(pet);
  }

  renamePet(name: string, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    if (!isPetClass(r.meta.cls)) {
      this.error(r.e.id, 'Only pet classes can rename pets.');
      return;
    }
    const pet = this.petOf(r.e.id, true);
    if (!pet) {
      this.error(r.e.id, 'You have no pet.');
      return;
    }
    const clean = this.cleanPetName(name);
    if (!clean) {
      this.error(
        r.e.id,
        'Pet name must be 2-16 letters/spaces/hyphen/apostrophe and start with a letter.',
      );
      return;
    }
    pet.name = clean;
    this.emit({ type: 'log', text: `Your pet is now named ${clean}.`, color: '#8f8', pid: r.e.id });
  }

  revivePet(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    if (!isPetClass(r.meta.cls)) {
      this.error(r.e.id, 'Only pet classes can revive pets.');
      return;
    }
    const pet = this.petOf(r.e.id, true);
    if (!pet) {
      this.error(r.e.id, 'You have no pet.');
      return;
    }
    if (!pet.dead) {
      this.error(r.e.id, 'Your pet is already alive.');
      return;
    }
    pet.dead = false;
    pet.hostile = false;
    pet.ownerId = r.e.id;
    pet.aiState = 'idle';
    pet.aggroTargetId = null;
    pet.inCombat = false;
    pet.corpseTimer = 0;
    pet.respawnTimer = 0;
    pet.loot = null;
    pet.lootable = false;
    pet.tappedById = null;
    clearThreat(pet);
    pet.pos = this.groundPos(r.e.pos.x + 2, r.e.pos.z + 1);
    pet.prevPos = { ...pet.pos };
    this.rebucket(pet);
    pet.hp = Math.max(1, Math.round(pet.maxHp * 0.35));
    this.emit({
      type: 'log',
      text: `${pet.name} returns to your side.`,
      color: '#8f8',
      pid: r.e.id,
    });
  }

  petAttack(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    if (!isPetClass(r.meta.cls)) {
      this.error(r.e.id, 'Only pet classes can command pets.');
      return;
    }
    r.meta.lastActiveTick = this.tickCount; // commanding the pet is a deliberate action
    const pet = this.petOf(r.e.id);
    if (!pet) {
      this.error(r.e.id, 'You have no living pet.');
      return;
    }
    const target = r.e.targetId !== null ? this.entities.get(r.e.targetId) : null;
    if (!target || target.dead || !this.isHostileTo(pet, target)) {
      this.error(r.e.id, 'Your pet needs a hostile target.');
      return;
    }
    pet.aggroTargetId = target.id;
    pet.inCombat = true;
    if (target.kind === 'mob' && target.hostile) addThreat(target, pet.id, 1);
  }

  petTaunt(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    if (!isPetClass(r.meta.cls)) {
      this.error(r.e.id, 'Only pet classes can command pets.');
      return;
    }
    r.meta.lastActiveTick = this.tickCount; // commanding the pet is a deliberate action
    const pet = this.petOf(r.e.id);
    if (!pet) {
      this.error(r.e.id, 'You have no living pet.');
      return;
    }
    if (pet.petTauntTimer > 0) {
      this.error(r.e.id, 'Pet taunt is not ready.');
      return;
    }
    const target =
      pet.aggroTargetId !== null
        ? (this.entities.get(pet.aggroTargetId) ?? null)
        : r.e.targetId !== null
          ? (this.entities.get(r.e.targetId) ?? null)
          : null;
    if (target?.kind !== 'mob' || target.dead || !target.hostile || target.ownerId !== null) {
      this.error(r.e.id, 'Your pet needs a hostile target.');
      return;
    }
    pet.aggroTargetId = target.id;
    pet.inCombat = true;
    addThreat(target, pet.id, 1);
    if (dist2d(pet.pos, target.pos) > PET_TAUNT_RANGE) {
      pet.petManualTauntPending = true;
      return;
    }
    this.applyTaunt(pet, target);
    pet.petManualTauntPending = false;
    pet.petTauntTimer = PET_GROWL_INTERVAL;
  }

  feedPet(itemId: string, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    if (r.meta.cls !== 'hunter') {
      this.error(r.e.id, 'Only hunters can feed pets.');
      return;
    }
    const pet = this.petOf(r.e.id);
    if (!pet) {
      this.error(r.e.id, 'You have no living pet.');
      return;
    }
    const item = ITEMS[itemId];
    if (item?.kind !== 'food' || !item.foodHp) {
      this.error(r.e.id, 'Your pet can only eat food.');
      return;
    }
    if (this.countItem(itemId, r.e.id) <= 0) {
      this.error(r.e.id, "You don't have that item.");
      return;
    }
    if (pet.hp >= pet.maxHp) {
      this.error(r.e.id, 'Your pet is already at full health.');
      return;
    }
    this.removeItem(itemId, 1, r.e.id);
    pet.auras = pet.auras.filter((a) => a.id !== 'feed_pet');
    this.applyAura(pet, {
      id: 'feed_pet',
      name: 'Fed',
      kind: 'hot',
      value: Math.max(1, Math.ceil(item.foodHp / PET_FEED_DURATION)),
      duration: PET_FEED_DURATION,
      remaining: PET_FEED_DURATION,
      sourceId: r.e.id,
      school: 'nature',
      tickInterval: PET_FEED_TICK,
      tickTimer: PET_FEED_TICK,
    });
    this.emit({ type: 'log', text: `You feed ${pet.name}.`, color: '#8f8', pid: r.e.id });
  }

  healPet(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    if (r.meta.cls !== 'warlock') {
      this.error(r.e.id, 'Only warlocks can channel demon healing.');
      return;
    }
    if (r.e.dead) {
      this.error(r.e.id, 'You are dead.');
      return;
    }
    if (isStunned(r.e)) {
      this.error(r.e.id, 'You are stunned.');
      return;
    }
    if (r.e.castingAbility) {
      this.error(r.e.id, 'You are busy.');
      return;
    }
    const pet = this.petOf(r.e.id);
    if (!pet) {
      this.error(r.e.id, 'You have no living demon.');
      return;
    }
    if (pet.hp >= pet.maxHp) {
      this.error(r.e.id, 'Your demon is already at full health.');
      return;
    }
    if (r.e.resource < DEMON_HEAL_MANA_COST) {
      this.error(r.e.id, 'Not enough mana!');
      return;
    }
    this.spendResource(r.e, DEMON_HEAL_MANA_COST);
    r.e.castingAbility = DEMON_HEAL_CAST_ID;
    r.e.castTotal = DEMON_HEAL_DURATION;
    r.e.castRemaining = DEMON_HEAL_DURATION;
    r.e.channeling = true;
    r.e.channelTickEvery = DEMON_HEAL_TICK;
    r.e.channelTickTimer = DEMON_HEAL_TICK;
    r.e.gcdRemaining = Math.max(r.e.gcdRemaining, this.playerGcdFor(r.meta.cls));
    this.emit({
      type: 'log',
      text: `You channel healing into ${pet.name}.`,
      color: '#b894ff',
      pid: r.e.id,
    });
    this.emit({
      type: 'castStart',
      entityId: r.e.id,
      ability: DEMON_HEAL_CAST_ID,
      time: DEMON_HEAL_DURATION,
    });
  }

  private applyDemonHealTick(owner: Entity): void {
    const pet = this.petOf(owner.id);
    if (!pet) {
      this.cancelCast(owner);
      return;
    }
    const amount = Math.max(1, Math.ceil(pet.maxHp * 0.08));
    const healed = Math.min(amount, pet.maxHp - pet.hp);
    if (healed <= 0) return;
    pet.hp += healed;
    this.emit({
      type: 'heal2',
      sourceId: owner.id,
      targetId: pet.id,
      amount: healed,
      crit: false,
      ability: 'Demon Heal',
    });
    this.healingThreat(owner, pet, healed);
  }

  setPetMode(mode: PetMode, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    if (!isPetClass(r.meta.cls)) {
      this.error(r.e.id, 'Only pet classes can command pets.');
      return;
    }
    r.meta.lastActiveTick = this.tickCount; // commanding the pet is a deliberate action
    const pet = this.petOf(r.e.id, true);
    if (!pet) {
      this.error(r.e.id, 'You have no pet.');
      return;
    }
    pet.petMode = mode;
    if (mode === 'passive') {
      pet.aggroTargetId = null;
      pet.inCombat = false;
      pet.autoAttack = false;
      pet.petManualTauntPending = false;
    }
    this.emit({ type: 'log', text: `${pet.name} is now ${mode}.`, color: '#ffd100', pid: r.e.id });
  }

  setPetAutoTaunt(enabled: boolean, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    if (!isPetClass(r.meta.cls)) {
      this.error(r.e.id, 'Only pet classes can command pets.');
      return;
    }
    r.meta.lastActiveTick = this.tickCount; // commanding the pet is a deliberate action
    const pet = this.petOf(r.e.id, true);
    if (!pet) {
      this.error(r.e.id, 'You have no pet.');
      return;
    }
    pet.petAutoTaunt = enabled;
  }

  /** Remove a summoned demon from the world entirely, scrubbing any references
   *  (player targets/combo, other mobs' hate) the way boss adds are despawned. */
  private despawnPet(pet: Entity): void {
    for (const meta of this.players.values()) {
      const e = this.entities.get(meta.entityId);
      if (!e) continue;
      if (e.targetId === pet.id) e.targetId = null;
      if (e.comboTargetId === pet.id) {
        e.comboTargetId = null;
        e.comboPoints = 0;
      }
    }
    for (const m of this.entities.values()) {
      if (m.kind !== 'mob' || m.id === pet.id) continue;
      m.threat.delete(pet.id);
      if (m.aggroTargetId === pet.id && !m.dead && m.aiState !== 'dead') this.retargetMob(m);
    }
    this.dropEntity(pet.id);
  }

  // -------------------------------------------------------------------------
  // Auto-attack & melee
  // -------------------------------------------------------------------------

  startAutoAttack(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const p = r.e;
    if (p.dead) return;
    const t = p.targetId !== null ? this.entities.get(p.targetId) : null;
    if (!t || t.dead || !this.isHostileTo(p, t)) {
      this.error(p.id, 'Invalid attack target.');
      return;
    }
    if (p.sitting) this.standUp(p);
    p.autoAttack = true;
    r.meta.lastActiveTick = this.tickCount; // starting auto-attack is a deliberate action
    const d = dist2d(p.pos, t.pos);
    const ranged = CLASSES[r.meta.cls].ranged;
    const inAutoAttackRange = ranged
      ? d <= ranged.maxRange &&
        d >= (ranged.wand ? 0 : ranged.minRange) &&
        this.hasLineOfSight(p, t)
      : d <= MELEE_RANGE;
    if (
      inAutoAttackRange &&
      t.kind === 'mob' &&
      t.hostile &&
      t.ownerId === null &&
      t.aiState !== 'evade'
    ) {
      if (t.aiState === 'idle') this.aggroMob(t, p, true);
      else if (t.aggroTargetId === null) t.aggroTargetId = p.id;
      addThreat(t, p.id, 1);
      p.combatTimer = 0;
      p.inCombat = true;
    }
  }

  stopAutoAttack(pid?: number): void {
    const r = this.resolve(pid);
    if (r) r.e.autoAttack = false;
  }

  private updatePlayerAutoAttack(p: Entity, meta: PlayerMeta): void {
    p.swingTimer = Math.max(0, p.swingTimer - DT);
    if (!p.autoAttack || p.castingAbility) return;
    const t = p.targetId !== null ? this.entities.get(p.targetId) : null;
    if (!t || t.dead || !this.isHostileTo(p, t)) {
      p.autoAttack = false;
      return;
    }
    if (p.swingTimer > 0) return;
    if (isStunned(p)) return;
    if (isDisarmed(p)) return; // weapon knocked away: no auto-attack swings
    const d = dist2d(p.pos, t.pos);
    const facingDiff = Math.abs(normAngle(angleTo(p.pos, t.pos) - p.facing));
    if (facingDiff > MELEE_ARC) return;

    // ranged auto-attack: hunters (auto shot, dead zone inside minRange) and
    // casters (wand-style, no dead zone so they don't run into melee — #94)
    const ranged = CLASSES[meta.cls].ranged;
    if (ranged && d <= ranged.maxRange && d >= (ranged.wand ? 0 : ranged.minRange)) {
      if (!this.hasLineOfSight(p, t)) return;
      this.breakGhostWolf(p);
      this.rangedSwing(p, t, ranged);
      p.swingTimer = ranged.speed * this.swingIntervalMult(p);
      return;
    }
    if (d > MELEE_RANGE) return;
    this.breakGhostWolf(p);

    let bonus = 0;
    let abilityName: string | null = null;
    let threatFlat = 0;
    let threatMult = 1;
    if (p.queuedOnSwing) {
      const queued = this.resolvedAbility(p.queuedOnSwing, p.id);
      if (queued) {
        const eff = queued.effects.find((e) => e.type === 'weaponDamage');
        if (p.resource >= queued.cost && eff && eff.type === 'weaponDamage') {
          this.spendResource(p, queued.cost);
          // on-next-swing abilities (e.g. Raptor Strike) resolve here rather than
          // in castAbility, so their cooldown must be applied on the swing too (#56)
          if (queued.def.cooldown > 0) p.cooldowns.set(queued.def.id, queued.def.cooldown);
          bonus = eff.bonus;
          abilityName = queued.def.name;
          threatFlat = queued.threatFlat;
          threatMult = queued.threatMult;
        }
      }
      p.queuedOnSwing = null;
    }
    this.meleeSwing(p, t, bonus, abilityName, { threatFlat, threatMult });
    p.swingTimer = p.weapon.speed * this.swingIntervalMult(p);
  }

  private rangedSwing(
    attacker: Entity,
    target: Entity,
    ranged: { min: number; max: number; speed: number; wand?: boolean; school?: string },
  ): void {
    const school = ranged.wand ? (ranged.school ?? 'arcane') : 'physical';
    const label = ranged.wand ? 'Wand' : 'Auto Shot';
    this.emit({
      type: 'spellfx',
      sourceId: attacker.id,
      targetId: target.id,
      school,
      fx: 'projectile',
    });
    const missChance =
      meleeMissChance(attacker.level, target.level) + blindMissBonus(attacker);
    if (this.rng.chance(missChance)) {
      this.emit({
        type: 'damage',
        sourceId: attacker.id,
        targetId: target.id,
        amount: 0,
        crit: false,
        school,
        ability: label,
        kind: 'miss',
      });
      this.enterCombat(attacker, target);
      return;
    }
    let dmg = this.rng.range(ranged.min, ranged.max) + (attacker.rangedPower / 14) * ranged.speed;
    // ranged white hits suffer the same higher-level crit suppression as melee
    const critChance = Math.max(
      0.005,
      attacker.critChance - Math.max(0, target.level - attacker.level) * 0.002,
    );
    const crit = this.rng.chance(critChance);
    if (crit) dmg *= 2;
    // wand bolts are magic — armor doesn't apply; physical auto shot is mitigated
    if (!ranged.wand) dmg *= 1 - armorReduction(this.effectiveArmor(target), attacker.level);
    this.dealDamage(attacker, target, Math.max(1, Math.round(dmg)), crit, school, label, 'hit');
  }

  // Returns true if the swing connected.
  private meleeSwing(
    attacker: Entity,
    target: Entity,
    bonus: number,
    abilityName: string | null,
    opts: {
      cannotBeDodged?: boolean;
      weaponMult?: number;
      threatFlat?: number;
      threatMult?: number;
    },
  ): boolean {
    const missChance =
      meleeMissChance(attacker.level, target.level) + blindMissBonus(attacker);
    const dodgeChance = opts.cannotBeDodged
      ? 0
      : target.kind === 'player'
        ? target.dodgeChance
        : 0.05 + Math.max(0, target.level - attacker.level) * 0.005;
    const roll = this.rng.next();
    if (roll < missChance) {
      this.emit({
        type: 'damage',
        sourceId: attacker.id,
        targetId: target.id,
        amount: 0,
        crit: false,
        school: 'physical',
        ability: abilityName,
        kind: 'miss',
      });
      this.enterCombat(attacker, target);
      return false;
    }
    if (roll < missChance + dodgeChance) {
      this.emit({
        type: 'damage',
        sourceId: attacker.id,
        targetId: target.id,
        amount: 0,
        crit: false,
        school: 'physical',
        ability: abilityName,
        kind: 'dodge',
      });
      this.enterCombat(attacker, target);
      if (attacker.kind === 'player') attacker.overpowerUntil = this.time + 5;
      return false;
    }
    const mult = opts.weaponMult ?? 1;
    // weapon imbues (seals, rockbiter) add flat damage to every swing
    let imbueBonus = 0;
    for (const a of attacker.auras) if (a.kind === 'imbue') imbueBonus += a.value;
    let dmg =
      (this.rng.range(attacker.weapon.min, attacker.weapon.max) +
        (this.effectiveAttackPower(attacker) / 14) * attacker.weapon.speed) *
        mult +
      bonus +
      imbueBonus;
    const critChance = Math.max(
      0.005,
      attacker.critChance - Math.max(0, target.level - attacker.level) * 0.002,
    );
    const crit = this.rng.chance(critChance);
    if (crit) dmg *= 2;
    dmg *= 1 - armorReduction(this.effectiveArmor(target), attacker.level);
    this.dealDamage(
      attacker,
      target,
      Math.max(1, Math.round(dmg)),
      crit,
      'physical',
      abilityName,
      'hit',
      false,
      { flat: opts.threatFlat ?? 0, mult: opts.threatMult ?? 1 },
    );
    // thorns / lightning shield: melee attackers take damage back
    if (!attacker.dead) {
      for (const a of target.auras) {
        if (a.kind === 'thorns') {
          this.dealDamage(target, attacker, a.value, false, a.school, a.name, 'hit', true);
        }
      }
      // innate "spiked hide" mobs (e.g. bristleback boars) reflect on every hit
      const spikes = MOBS[target.templateId]?.thorns;
      if (spikes && !attacker.dead) {
        this.dealDamage(
          target,
          attacker,
          spikes.value,
          false,
          spikes.school ?? 'physical',
          spikes.name ?? 'Spiked Hide',
          'hit',
          true,
        );
      }
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Damage / death
  // -------------------------------------------------------------------------

  dealDamage(
    source: Entity | null,
    target: Entity,
    amount: number,
    crit: boolean,
    school: string,
    ability: string | null,
    kind: 'hit' | 'miss' | 'dodge',
    noRage = false,
    threatOpts?: { flat?: number; mult?: number },
  ): void {
    dealDamageImpl(
      this.ctx,
      source,
      target,
      amount,
      crit,
      school,
      ability,
      kind,
      noRage,
      threatOpts,
    );
  }

  private enterCombat(a: Entity, b: Entity): void {
    a.combatTimer = 0;
    b.combatTimer = 0;
    a.inCombat = true;
    b.inCombat = true;
    // players and their pets pull wild mobs; pets never run wild-mob AI
    const aAttacker = a.kind === 'player' || (a.kind === 'mob' && a.ownerId !== null);
    if (b.kind === 'mob' && b.ownerId === null && !b.dead && aAttacker && b.aiState !== 'evade') {
      if (b.aiState === 'idle') this.aggroMob(b, a, true);
      else if (b.aggroTargetId === null) b.aggroTargetId = a.id;
    }
    if (
      a.kind === 'mob' &&
      a.ownerId === null &&
      !a.dead &&
      b.kind === 'player' &&
      a.aiState === 'idle'
    ) {
      this.aggroMob(a, b, false);
    }
  }

  private handleDeath(e: Entity, killer: Entity | null): void {
    // Body moved to combat/damage.ts (C1). The moved copy routes its quest-credit
    // call through ctx.onMobKilledForQuests (points-at quest_credit, Q1).
    handleDeathImpl(this.ctx, e, killer);
  }

  // True while the player is standing in (or just beside) an inn footprint and
  // out of combat — the classic "resting" state that accrues rested XP.
  private isResting(p: Entity): boolean {
    if (p.inCombat) return false;
    for (const b of PROPS.buildings) {
      if (b.kind !== 'inn') continue;
      // Point-in-rotated-rect: bring the player into the inn's local frame.
      const dx = p.pos.x - b.x;
      const dz = p.pos.z - b.z;
      const cos = Math.cos(-b.rot);
      const sin = Math.sin(-b.rot);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (
        Math.abs(lx) <= b.w / 2 + RESTED_INN_PADDING &&
        Math.abs(lz) <= b.d / 2 + RESTED_INN_PADDING
      )
        return true;
    }
    return false;
  }

  // Accrue rested XP while resting in an inn. Vanilla: 5% of the level's
  // XP-to-level per 8 in-game hours, clamped to 1.5 levels. Deterministic —
  // paced off DT, never wall-clock. No accrual at the cap (no level bar).
  private updateRested(p: Entity, meta: PlayerMeta): void {
    if (p.level >= MAX_LEVEL) return;
    const cap = RESTED_CAP_LEVELS * xpForLevel(p.level);
    if (meta.restedXp >= cap) {
      meta.restedXp = cap;
      return;
    }
    if (!this.isResting(p)) return;
    const fillSeconds = RESTED_FILL_HOURS * RESTED_SECONDS_PER_GAME_HOUR;
    const perSecond = (RESTED_FILL_FRACTION * xpForLevel(p.level)) / fillSeconds;
    meta.restedXp = Math.min(cap, meta.restedXp + perSecond * DT);
  }

  grantXp(amount: number, meta: PlayerMeta = this.primary, opts?: { fromKill?: boolean }): void {
    grantXpImpl(this.ctx, amount, meta, opts);
  }

  // Opt-in cosmetic prestige: only at the cap. Resets the level XP
  // bar, bumps the prestige rank for a badge by the name + on the leaderboard,
  // and deliberately leaves lifetimeXp, level, gear, talents, and learned
  // abilities untouched — strictly cosmetic, zero power change (FR-6.1/6.3).
  prestige(pid?: number): boolean {
    const r = this.resolve(pid);
    if (!r) return false;
    // Authoritative anti-abuse gate: must be at the cap AND have earned a full
    // prestige bar of post-cap XP since the last rank. This caps prestigeRank at
    // what lifetimeXp supports, so spamming the `prestige` command (e.g. from a
    // hacked client) can never inflate the rank beyond XP actually earned.
    if (!canPrestige(r.e.level, r.meta.lifetimeXp, r.meta.prestigeRank)) return false;
    r.meta.xp = 0;
    r.meta.prestigeRank += 1;
    this.emit({
      type: 'log',
      pid: r.e.id,
      text: `You have prestiged! Prestige Rank ${r.meta.prestigeRank}.`,
      color: '#ffd100',
    });
    return true;
  }

  private needsQuestDrop(entry: LootEntry, meta: PlayerMeta): boolean {
    if (!entry.questId || !entry.itemId) return false;
    const qp = meta.questLog.get(entry.questId);
    if (qp?.state !== 'active') return false;
    const quest = QUESTS[entry.questId];
    const objIdx = quest.objectives.findIndex(
      (o) => o.type === 'collect' && o.itemId === entry.itemId,
    );
    // A quest-gated drop is only "needed" while the player has an actual collect
    // objective for this item that is still short of its required count. If the
    // quest has no matching collect objective, the player never needs the item,
    // so it must not drop (fail closed rather than dropping unconditionally).
    return (
      objIdx >= 0 && this.countItem(entry.itemId, meta.entityId) < quest.objectives[objIdx].count
    );
  }

  private rollLoot(mob: Entity, meta: PlayerMeta, eligible: PlayerMeta[] = [meta]): void {
    const template = MOBS[mob.templateId];
    if (!template) return;
    let copper = 0;
    const items: LootSlot[] = [];
    const rolledGroups = new Set<string>();
    for (const entry of template.loot) {
      // Exclusive groups: a single rng draw is partitioned by the group
      // entries' chances, so at most one matching entry drops.
      // Exactly one rng.next() per group keeps replays deterministic.
      if (entry.rollGroup) {
        if (rolledGroups.has(entry.rollGroup)) continue;
        rolledGroups.add(entry.rollGroup);
        const group = template.loot.filter((l) => l.rollGroup === entry.rollGroup);
        const roll = this.rng.next();
        let cumulative = 0;
        for (const g of group) {
          cumulative += g.chance;
          if (roll < cumulative) {
            if (g.itemId) items.push({ itemId: g.itemId, count: 1 });
            break;
          }
        }
        continue;
      }
      if (entry.questId) {
        const questRecipients = eligible.filter((m) => this.needsQuestDrop(entry, m));
        if (questRecipients.length === 0) continue;
        if (!this.rng.chance(entry.chance)) continue;
        items.push({
          itemId: entry.itemId!,
          count: 1,
          personalFor: questRecipients.map((m) => m.entityId),
        });
        continue;
      }
      if (!this.rng.chance(entry.chance)) continue;
      if (entry.copper)
        copper += this.rng.int(Math.ceil(entry.copper * 0.6), Math.ceil(entry.copper * 1.4));
      if (entry.itemId) items.push({ itemId: entry.itemId, count: 1 });
    }
    if (copper > 0 || items.length > 0) {
      mob.loot = { copper, items };
      mob.lootable = true;
    }
  }

  private grantLootCopper(meta: PlayerMeta, amount: number): void {
    meta.copper += amount;
    meta.counters.lootCopper += amount;
    this.emit({ type: 'loot', text: `You loot ${formatMoney(amount)}.`, pid: meta.entityId });
  }

  private awardAllCopperToLooter(looter: PlayerMeta, copper: number): void {
    this.grantLootCopper(looter, copper);
  }

  private tryAwardCopperByFairSplit(mob: Entity, copper: number): boolean {
    if (this.effectiveCurrencyLootStrategy(mob) !== 'fair-split') return false;
    const candidates = this.partyLootCandidatesForMob(mob);
    if (candidates.length <= 1) return false;
    const base = Math.floor(copper / candidates.length);
    const remainder = copper % candidates.length;
    const shares = new Map<PlayerMeta, number>(candidates.map((candidate) => [candidate, base]));
    const order = [...candidates];
    for (let i = 0; i < remainder; i++) {
      const idx = this.rng.int(i, order.length - 1);
      [order[i], order[idx]] = [order[idx], order[i]];
      shares.set(order[i], (shares.get(order[i]) ?? 0) + 1);
    }
    for (const candidate of candidates) {
      const amount = shares.get(candidate) ?? 0;
      if (amount > 0) this.grantLootCopper(candidate, amount);
    }
    return true;
  }

  private distributeLootCopper(mob: Entity, looter: PlayerMeta): void {
    if (!mob.loot || mob.loot.copper <= 0) return;
    const copper = mob.loot.copper;
    if (!this.tryAwardCopperByFairSplit(mob, copper)) this.awardAllCopperToLooter(looter, copper);
    mob.loot.copper = 0;
  }

  private startNeedGreedRoll(itemId: string, mob: Entity): boolean {
    if (this.effectiveItemLootStrategy(itemId, mob) !== 'need-greed') return false;
    const candidates = this.partyLootCandidatesForMob(mob);
    if (candidates.length <= 1) return false;
    const def = ITEMS[itemId];
    const itemName = def?.name ?? itemId;
    const roll: PendingLootRoll = {
      id: this.nextLootRollId++,
      mobId: mob.id,
      itemId,
      itemName,
      quality: def?.quality,
      candidates: candidates.map((candidate) => candidate.entityId),
      choices: new Map(),
      expiresAt: this.time + LOOT_ROLL_TIMEOUT,
    };
    this.pendingLootRolls.set(roll.id, roll);
    mob.corpseTimer = Math.max(mob.corpseTimer, LOOT_ROLL_TIMEOUT + 2);
    for (const candidate of candidates) {
      this.emit({
        type: 'lootRoll',
        rollId: roll.id,
        itemId,
        itemName,
        quality: roll.quality,
        expiresAt: roll.expiresAt,
        pid: candidate.entityId,
      });
    }
    return true;
  }

  private awardSharedLootItem(itemId: string, mob: Entity, looter: PlayerMeta): void {
    if (!this.startNeedGreedRoll(itemId, mob)) this.addItem(itemId, 1, looter.entityId);
  }

  // Open need-greed rolls the given player may still answer. Mirrors the
  // `lootRoll` events but is reconciled from authoritative state, so a client
  // that missed an event (reconnect, interest churn, a dropped frame) can
  // re-show the prompt instead of losing the roll while groupmates roll.
  activeLootRolls(pid = this.playerId): LootRollPrompt[] {
    const out: LootRollPrompt[] = [];
    for (const roll of this.pendingLootRolls.values()) {
      if (!roll.candidates.includes(pid) || roll.choices.has(pid)) continue;
      out.push({
        rollId: roll.id,
        itemId: roll.itemId,
        itemName: roll.itemName,
        quality: roll.quality,
        expiresAt: roll.expiresAt,
      });
    }
    return out;
  }

  submitLootRoll(rollId: number, choice: LootRollChoice, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const roll = this.pendingLootRolls.get(rollId);
    if (!roll?.candidates.includes(r.meta.entityId) || roll.choices.has(r.meta.entityId)) return;
    roll.choices.set(r.meta.entityId, {
      choice,
      roll: choice === 'need' || choice === 'greed' ? this.rng.int(1, 100) : null,
    });
    if (roll.choices.size >= roll.candidates.length) this.resolveLootRoll(roll);
  }

  private resolveLootRoll(roll: PendingLootRoll): void {
    if (!this.pendingLootRolls.delete(roll.id)) return;
    const entries = roll.candidates
      .map((pid) => ({
        pid,
        result: roll.choices.get(pid) ?? { choice: 'pass' as const, roll: null },
      }))
      .filter((entry) => entry.result.choice !== 'pass');
    const needers = entries.filter((entry) => entry.result.choice === 'need');
    const contenders =
      needers.length > 0 ? needers : entries.filter((entry) => entry.result.choice === 'greed');
    if (contenders.length === 0) {
      this.returnLootRollItemToCorpse(roll);
      for (const pid of roll.candidates)
        this.emit({ type: 'loot', text: `Everyone passed on ${roll.itemName}.`, pid });
      return;
    }
    let winner = contenders[0];
    for (const contender of contenders.slice(1)) {
      if ((contender.result.roll ?? 0) > (winner.result.roll ?? 0)) winner = contender;
    }
    const winnerMeta = this.players.get(winner.pid);
    const winnerName = winnerMeta?.name ?? 'Unknown';
    for (const pid of roll.candidates) {
      this.emit({
        type: 'loot',
        text: `${winnerName} wins ${roll.itemName} (${winner.result.roll ?? 0})`,
        pid,
      });
    }
    this.addItem(roll.itemId, 1, winner.pid);
  }

  private returnLootRollItemToCorpse(roll: PendingLootRoll): void {
    const mob = this.entities.get(roll.mobId);
    if (!mob?.dead) return;
    if (!mob.loot) mob.loot = { copper: 0, items: [] };
    const existing = mob.loot.items.find(
      (slot) => slot.openToAll && slot.itemId === roll.itemId && !slot.personalFor,
    );
    if (existing) existing.count += 1;
    else mob.loot.items.push({ itemId: roll.itemId, count: 1, openToAll: true });
    mob.lootable = true;
  }

  private lootSlotVisibleTo(slot: LootSlot, pid: number): boolean {
    return slot.openToAll || !slot.personalFor || slot.personalFor.includes(pid);
  }

  private hasPendingLootRollForMob(mobId: number): boolean {
    return [...this.pendingLootRolls.values()].some((roll) => roll.mobId === mobId);
  }

  private pruneCorpseLoot(mob: Entity): void {
    if (!mob.loot) return;
    mob.loot.items = mob.loot.items.filter(
      (s) => s.count > 0 && (!s.personalFor || s.personalFor.length > 0),
    );
    if (mob.loot.copper <= 0 && mob.loot.items.length === 0) {
      if (this.hasPendingLootRollForMob(mob.id)) {
        mob.loot = null;
        mob.lootable = true;
        mob.corpseTimer = Math.max(mob.corpseTimer, LOOT_ROLL_TIMEOUT + 2);
        return;
      }
      mob.loot = null;
      mob.lootable = false;
      mob.corpseTimer = Math.min(mob.corpseTimer, 4);
    }
  }

  // -------------------------------------------------------------------------
  // Mob AI
  // -------------------------------------------------------------------------

  private refreshMobLeashFromAction(source: Entity | null, target: Entity): void {
    if (
      !source ||
      source.id === target.id ||
      target.kind !== 'mob' ||
      target.ownerId !== null ||
      target.dead
    )
      return;
    if (source.kind !== 'player' && source.ownerId === null) return;
    target.leashAnchor = { ...target.pos };
  }

  // Target selection + threat switching live in mob/targeting.ts (M1). These thin
  // delegates keep every `this.retargetMob` / `this.updateMobTarget` / `this.isTrivialTo`
  // call site (and the ctx.retargetMob seam binding) resolving unchanged through the seam.
  private retargetMob(mob: Entity): void {
    retargetMobFn(this.ctx, mob);
  }

  private findNythraxisBossForAdd(add: Entity): Entity | null {
    if (add.kind !== 'mob' || add.templateId !== NYTHRAXIS_ADD_ID) return null;
    for (const e of this.entities.values()) {
      if (e.kind !== 'mob' || e.templateId !== NYTHRAXIS_BOSS_ID || e.dead) continue;
      if (e.summonedIds.includes(add.id) || dist2d(e.spawnPos, add.spawnPos) < 1) return e;
    }
    return null;
  }

  private nythraxisAddFallbackTarget(add: Entity): Entity | null {
    const boss = this.findNythraxisBossForAdd(add);
    if (!boss?.inCombat || boss.aiState === 'idle' || boss.aiState === 'evade') return null;
    const target = boss.aggroTargetId !== null ? this.entities.get(boss.aggroTargetId) : null;
    return target && !target.dead && target.kind === 'player' ? target : null;
  }

  private scheduleNythraxisAddDespawnIfBossReset(add: Entity): boolean {
    const boss = this.findNythraxisBossForAdd(add);
    if (!boss || (boss.inCombat && boss.aiState !== 'idle' && boss.aiState !== 'evade'))
      return false;
    add.aggroTargetId = null;
    add.aiState = 'idle';
    add.inCombat = false;
    add.hostile = false;
    add.despawnTimer = add.despawnTimer ?? 10;
    clearThreat(add);
    return true;
  }

  // highestThreatTarget moved to mob/targeting.ts (M1); retargetMob/updateMobTarget
  // call it there. No Sim delegate: it had no caller outside those two methods.

  private updateMobTarget(mob: Entity): void {
    updateMobTargetFn(this.ctx, mob);
  }

  // Effective melee reach. Large creatures measure range from their centre, which
  // sits deep inside an oversized body — so a giant (e.g. Nythraxis at scale 3.1)
  // can never close to the flat MELEE_RANGE and barely swings. Scale reach with
  // size so big mobs connect from where the player actually stands (their feet).
  private mobMeleeRange(mob: Entity): number {
    return this.mobCombatProfile(mob).meleeRange;
  }

  private mobCombatProfile(mob: Entity): MobCombatProfile {
    return combatProfileForMob(mob.templateId, mob.scale);
  }

  private mobEffectiveMeleeRange(mob: Entity): number {
    const profile = this.mobCombatProfile(mob);
    const mobMoved = dist2d(mob.pos, mob.prevPos) > 0.05;
    return effectiveMobMeleeRange(profile, mobMoved);
  }

  private tryMobMeleeSwingInRange(mob: Entity, target: Entity): boolean {
    if (dist2d(mob.pos, target.pos) > this.mobEffectiveMeleeRange(mob)) return false;
    mob.aiState = 'attack';
    mob.facing = angleTo(mob.pos, target.pos);
    if (mob.swingTimer <= 0) {
      this.mobSwing(mob, target);
      mob.swingTimer = mob.weapon.speed * this.swingIntervalMult(mob);
    }
    return true;
  }

  private usesProfiledMobCombat(mob: Entity): boolean {
    const profile = this.mobCombatProfile(mob);
    return profile.swingWhilePursuing || profile.immediateSwingOnEnterRange || !profile.canLeash;
  }

  private updateProfiledMobCombat(mob: Entity): void {
    const profile = this.mobCombatProfile(mob);
    this.updateMobTarget(mob);
    const target = mob.aggroTargetId !== null ? this.entities.get(mob.aggroTargetId) : null;
    if (!target || target.dead) {
      this.retargetMob(mob);
      return;
    }
    if (this.maybeFlee(mob, target)) return;

    if (profile.canLeash) {
      const leash = mob.spawnPos.x > DUNGEON_X_THRESHOLD ? DUNGEON_LEASH_DISTANCE : LEASH_DISTANCE;
      const leashAnchor = mob.leashAnchor ?? mob.spawnPos;
      if (mob.fleeReturnTimer > 0) {
        mob.fleeReturnTimer = Math.max(0, mob.fleeReturnTimer - DT);
        if (dist2d(mob.pos, leashAnchor) <= leash - 1) mob.fleeReturnTimer = 0;
      }
      if (dist2d(mob.pos, leashAnchor) > leash && mob.fleeReturnTimer <= 0) {
        mob.aiState = 'evade';
        mob.aggroTargetId = null;
        clearThreat(mob);
        mob.leashAnchor = null;
        return;
      }
    }

    mob.swingTimer = Math.max(0, mob.swingTimer - DT);
    if (profile.swingWhilePursuing || mob.aiState === 'attack') {
      this.tryMobMeleeSwingInRange(mob, target);
    }

    if (dist2d(mob.pos, target.pos) > profile.desiredRange) {
      if (!isRooted(mob)) {
        this.moveToward(
          mob,
          target.pos,
          mob.moveSpeed * profile.chaseSpeedMult * this.moveSpeedMult(mob),
        );
      } else {
        mob.facing = angleTo(mob.pos, target.pos);
      }
    } else {
      mob.facing = angleTo(mob.pos, target.pos);
    }

    if (
      profile.immediateSwingOnEnterRange ||
      profile.swingWhilePursuing ||
      mob.aiState === 'attack'
    ) {
      this.tryMobMeleeSwingInRange(mob, target);
    }
    mob.aiState = dist2d(mob.pos, target.pos) <= profile.meleeRange ? 'attack' : 'chase';
  }

  aggroMob(mob: Entity, target: Entity, social: boolean): void {
    if (
      mob.dead ||
      mob.aiState === 'evade' ||
      mob.aiState === 'chase' ||
      mob.aiState === 'attack' ||
      mob.aiState === 'flee'
    )
      return;
    mob.aiState = 'chase';
    mob.aggroTargetId = target.id;
    mob.inCombat = true;
    mob.leashAnchor = { ...mob.pos };
    addThreat(mob, target.id, 1); // seed the hate table so taunts/heals have a baseline
    if (target.kind === 'player' && MOBS[mob.templateId]?.boss) {
      const run = this.delveRunForPlayer(target.id);
      if (run) this.maybeCompanionBark(run, target.id, 'boss_pull');
    }
    if (social) {
      const family = MOBS[mob.templateId]?.family;
      const pullRadius = (family && SOCIAL_PULL_RADIUS[family]) ?? DEFAULT_SOCIAL_PULL_RADIUS;
      this.grid.forEachInRadius(mob.pos.x, mob.pos.z, pullRadius, (m, d2) => {
        if (
          m.kind === 'mob' &&
          m.id !== mob.id &&
          !m.dead &&
          m.hostile &&
          m.aiState === 'idle' &&
          m.ownerId === null &&
          m.templateId === mob.templateId &&
          d2 < pullRadius * pullRadius
        ) {
          m.aiState = 'chase';
          m.aggroTargetId = target.id;
          m.inCombat = true;
          m.leashAnchor = { ...m.pos };
          addThreat(m, target.id, 1);
        }
      });
    }
  }

  private isTrivialTo(mob: Entity, player: Entity): boolean {
    return isTrivialToFn(mob, player);
  }

  private updateMob(mob: Entity): void {
    updateMobFn(this.ctx, mob);
  }

  // Boss-death dialogue hook (left by M2 for N1). updateMob (now in mob/locomotion.ts)
  // calls this via ctx.onBossDeath for every dead mob; the Nythraxis death dialogue is
  // the only current handler and the body stays on Sim until N1 owns the encounter.
  // Draws no rng, so calling it unconditionally for every dead mob preserves draw order.
  private onBossDeath(mob: Entity): void {
    if (mob.templateId === NYTHRAXIS_BOSS_ID && mob.nythraxis && !mob.nythraxis.deathSpoken) {
      mob.nythraxis.deathSpoken = true;
      mob.nythraxis.phase = 'dead';
      this.nythraxisDialogueSet(mob, [
        { speaker: 'nythraxis', text: 'Malric...', delay: 0 },
        {
          speaker: 'nythraxis',
          text: 'What have you done',
          delay: NYTHRAXIS_DIALOGUE_LINE_SECONDS,
        },
      ]);
    }
  }

  // resetEvadingMob moved to mob/locomotion.ts (M2). Sim keeps a thin delegate because
  // wipeNythraxisEncounter + 8 mob_* tests + the parity scenario call sim.resetEvadingMob.
  private resetEvadingMob(mob: Entity): void {
    resetEvadingMobFn(this.ctx, mob);
  }

  // Cowardly mobs panic once per pull at low HP: turn and run from the attacker
  // for a few seconds, rallying nearby same-family allies. Returns true if the mob
  // entered (or is already in) the flee state so the caller can stop its turn.
  private canFlee(mob: Entity): boolean {
    if (mob.hasFled || mob.enraged) return false;
    const tmpl = MOBS[mob.templateId];
    if (!tmpl || tmpl.boss || tmpl.elite || tmpl.rare) return false;
    return FLEEING_FAMILIES.has(tmpl.family);
  }

  private maybeFlee(mob: Entity, target: Entity): boolean {
    if (mob.maxHp <= 0 || mob.hp / mob.maxHp > FLEE_HP_THRESHOLD) return false;
    if (!this.canFlee(mob)) return false;
    mob.aiState = 'flee';
    mob.hasFled = true;
    mob.fleeTimer = FLEE_DURATION;
    this.emit({
      type: 'log',
      text: `${mob.name} attempts to flee!`,
      color: '#ffd966',
      entityId: mob.id,
    });
    this.callForHelp(mob, target);
    return true;
  }

  // A fleeing mob shouts for aid: nearby idle same-family mobs join the fight,
  // mirroring the social-pull seeding in aggroMob.
  private callForHelp(mob: Entity, target: Entity): void {
    const family = MOBS[mob.templateId]?.family;
    if (!family) return;
    this.grid.forEachInRadius(mob.pos.x, mob.pos.z, FLEE_HELP_RADIUS, (m, d2) => {
      if (
        m.kind === 'mob' &&
        m.id !== mob.id &&
        !m.dead &&
        m.hostile &&
        m.aiState === 'idle' &&
        m.ownerId === null &&
        MOBS[m.templateId]?.family === family &&
        d2 < FLEE_HELP_RADIUS * FLEE_HELP_RADIUS
      ) {
        m.aiState = 'chase';
        m.aggroTargetId = target.id;
        m.inCombat = true;
        m.leashAnchor = { ...m.pos };
        addThreat(m, target.id, 1);
      }
    });
  }

  mobSwing(mob: Entity, target: Entity): void {
    const missChance = meleeMissChance(mob.level, target.level);
    const dodgeChance = target.kind === 'player' ? target.dodgeChance : 0.05;
    const roll = this.rng.next();
    if (roll < missChance) {
      this.emit({
        type: 'damage',
        sourceId: mob.id,
        targetId: target.id,
        amount: 0,
        crit: false,
        school: 'physical',
        ability: null,
        kind: 'miss',
      });
      return;
    }
    if (roll < missChance + dodgeChance) {
      this.emit({
        type: 'damage',
        sourceId: mob.id,
        targetId: target.id,
        amount: 0,
        crit: false,
        school: 'physical',
        ability: null,
        kind: 'dodge',
      });
      return;
    }
    let dmg =
      this.rng.range(mob.weapon.min, mob.weapon.max) +
      (this.effectiveAttackPower(mob) / 14) * mob.weapon.speed;
    const crit = this.rng.chance(0.05);
    if (crit) dmg *= 2;
    const enrage = MOBS[mob.templateId]?.enrage;
    if (mob.enraged && enrage) dmg *= enrage.dmgMult;
    const rawDmg = dmg; // pre-armor, post-crit/enrage — basis for cleave splash
    dmg *= 1 - armorReduction(this.effectiveArmor(target), mob.level);
    const dealt = Math.max(1, Math.round(dmg));
    this.dealDamage(mob, target, dealt, crit, 'physical', null, 'hit');
    runMobSwingAffixes(this.ctx, mob, target, { dealt, crit, rawDmg });
  }

  // Recompute a player victim's derived stats after the Devour Magic cascade in
  // mob_swing.ts strips a beneficial aura, so a stripped buff_armor/buff_ap/buff_int
  // actually un-folds. Routed through SimContext (ctx.recalcPlayer) so the extracted
  // module never reaches into the Sim players map directly.
  private recalcPlayer(target: Entity): void {
    const meta = this.players.get(target.id);
    if (meta) recalcPlayerStats(target, meta.cls, meta.equipment, meta.talentMods);
  }

  // Pet brain: assist the owner (attack whatever they fight or whatever
  // attacks either of you), otherwise heel. Pets swing like mobs and build
  // their own entries on enemy hate tables.
  private updatePet(pet: Entity): void {
    const owner = pet.ownerId !== null ? this.entities.get(pet.ownerId) : null;
    if (owner?.kind !== 'player' || !this.players.has(owner.id)) {
      this.despawnPersistentPet(pet);
      return;
    }
    if (isStunned(pet)) return;
    this.syncPetAspect(pet, owner);
    pet.petTauntTimer = Math.max(0, pet.petTauntTimer - DT);
    if (!pet.inCombat && this.tickCount % 40 === 0 && pet.hp < pet.maxHp) {
      pet.hp = Math.min(pet.maxHp, pet.hp + Math.max(1, Math.round(pet.maxHp * 0.02)));
    }

    let target = pet.aggroTargetId !== null ? (this.entities.get(pet.aggroTargetId) ?? null) : null;
    if (target && (target.dead || !this.isHostileTo(pet, target))) target = null;
    if (target && dist2d(owner.pos, pet.pos) > PET_LEASH) target = null;
    if (!target && !owner.dead) target = this.petPickTarget(pet, owner);
    pet.aggroTargetId = target?.id ?? null;
    pet.inCombat = target !== null;
    if (!target) pet.petManualTauntPending = false;

    if (target) {
      // ranged demon (imp) holds its distance and hurls bolts; melee pets close
      // in, taunt to hold threat (voidwalker tank), and swing
      const ranged = MOBS[pet.templateId]?.petRanged;
      const template = MOBS[pet.templateId];
      if (!ranged && template?.petRole === 'ranged_dps' && template.petSpell) {
        this.updateRangedPetAttack(pet, target, template.petSpell);
        return;
      }
      const reach = ranged ? ranged.range : MELEE_RANGE * 0.8;
      const d = dist2d(pet.pos, target.pos);
      if (d > reach) {
        if (!isRooted(pet))
          this.moveToward(pet, target.pos, pet.moveSpeed * this.moveSpeedMult(pet));
        pet.swingTimer = Math.max(0, pet.swingTimer - DT);
      } else {
        pet.facing = angleTo(pet.pos, target.pos);
        if (
          target.kind === 'mob' &&
          !ranged &&
          pet.petTauntTimer <= 0 &&
          (pet.petAutoTaunt || pet.petManualTauntPending)
        ) {
          this.applyTaunt(pet, target);
          pet.petManualTauntPending = false;
          pet.petTauntTimer = PET_GROWL_INTERVAL;
        }
        pet.swingTimer -= DT;
        if (pet.swingTimer <= 0) {
          if (ranged) this.petRangedAttack(pet, target, ranged);
          else this.mobSwing(pet, target);
          pet.swingTimer = pet.weapon.speed * this.swingIntervalMult(pet);
        }
      }
      return;
    }

    // heel
    pet.swingTimer = Math.max(0, pet.swingTimer - DT);
    this.petFollow(pet, owner);
  }

  // Heel locomotion: route the pet to its owner AROUND obstacles instead of
  // letting greedy slide-steering wedge on a wall and then snapping the pet to
  // the owner. Mirrors the warrior-charge path cache (`petPath`): A* is recomputed
  // at most every PET_PATH_RECALC and otherwise the cached waypoints are followed.
  // The 60yd teleport is kept only as a true last resort, for when no route to the
  // owner exists at all (e.g. owner stranded across un-navigable terrain).
  private petFollow(pet: Entity, owner: Entity): void {
    pet.petPathCooldown = Math.max(0, pet.petPathCooldown - DT);
    const d = dist2d(pet.pos, owner.pos);
    if (d <= PET_FOLLOW_DISTANCE) {
      pet.petPath = [];
      return;
    }
    if (isRooted(pet)) return;

    const swim = this.mobCanSwim(MOBS[pet.templateId]);
    const recompute = (): void => {
      pet.petPath = findPlayerPath(
        this.cfg.seed,
        pet.pos,
        owner.pos,
        PET_PATH_SPAN,
        false,
        swim,
      ).map((w) => ({ x: w.x, y: 0, z: w.z }));
      pet.petPathCooldown = PET_PATH_RECALC;
    };
    // recompute when the throttle has elapsed and the cache is stale: empty, or
    // its end no longer lands near the (now-moved) owner. findPlayerPath returns a
    // single-waypoint straight line (length 1) when the goal is unreachable.
    const end = pet.petPath[pet.petPath.length - 1];
    const stale = !end || dist2d(end, owner.pos) > PET_PATH_STALE_DISTANCE;
    if (pet.petPathCooldown <= 0 && stale) recompute();
    // drop waypoints we've reached; the last leg homes on the live owner position.
    while (pet.petPath.length > 1 && dist2d(pet.pos, pet.petPath[0]) < PET_WAYPOINT_REACHED)
      pet.petPath.shift();

    // Last-resort teleport: only when the owner is far AND genuinely unreachable.
    // We confirm with a FRESH path (ignoring the throttle) so a stale single-point
    // cache from a moment ago can never trigger a spurious snap while a real route
    // exists — e.g. right after a combat→heel transition.
    if (
      pet.petPath.length <= 1 &&
      d > PET_TELEPORT_DISTANCE &&
      !lineOfSightClear(this.cfg.seed, pet.pos, owner.pos, BODY_RADIUS)
    ) {
      recompute();
      if (pet.petPath.length <= 1) {
        pet.pos = { ...owner.pos };
        pet.prevPos = { ...pet.pos };
        pet.petPath = [];
        // a warp is a teleport: keep the spatial grid exact this tick instead of
        // waiting for the end-of-tick refresh, so same-tick aggro/AoE queries
        // don't miss the pet at its old cell (matches every other teleport site)
        this.rebucket(pet);
        return;
      }
    }

    const routed = pet.petPath.length > 1;
    const aim = routed ? pet.petPath[0] : owner.pos;
    const speed = Math.max(pet.moveSpeed, RUN_SPEED * 1.1) * this.moveSpeedMult(pet);
    this.moveToward(pet, aim, speed);
  }

  /** A ranged demon pet (imp) hurls a spell-school bolt: a telegraphed
   *  projectile that bypasses armor, mirroring the player caster path. Damage
   *  comes from the mob's weapon range + AP, exactly like its melee siblings. */
  private petRangedAttack(
    pet: Entity,
    target: Entity,
    ranged: { range: number; school: Aura['school'] },
  ): void {
    this.emit({
      type: 'spellfx',
      sourceId: pet.id,
      targetId: target.id,
      school: ranged.school,
      fx: 'projectile',
    });
    const crit = this.rng.chance(0.05);
    let dmg =
      this.rng.range(pet.weapon.min, pet.weapon.max) +
      (this.effectiveAttackPower(pet) / 14) * pet.weapon.speed;
    if (crit) dmg *= 2;
    this.dealDamage(pet, target, Math.max(1, Math.round(dmg)), crit, ranged.school, null, 'hit');
  }

  private updateRangedPetAttack(
    pet: Entity,
    target: Entity,
    spell: {
      name: string;
      school: 'physical' | 'fire' | 'frost' | 'arcane' | 'shadow' | 'holy' | 'nature';
      min: number;
      max: number;
      range: number;
      every: number;
    },
  ): void {
    const d = dist2d(pet.pos, target.pos);
    if (d > spell.range) {
      if (!isRooted(pet))
        this.moveToward(pet, target.pos, pet.moveSpeed * this.moveSpeedMult(pet));
      pet.swingTimer = Math.max(0, pet.swingTimer - DT);
      return;
    }
    pet.facing = angleTo(pet.pos, target.pos);
    pet.swingTimer -= DT;
    if (pet.swingTimer > 0) return;
    this.emit({
      type: 'spellfx',
      sourceId: pet.id,
      targetId: target.id,
      school: spell.school,
      fx: 'projectile',
    });
    if (!this.rng.chance(spellHitChance(pet.level, target.level))) {
      this.emit({
        type: 'damage',
        sourceId: pet.id,
        targetId: target.id,
        amount: 0,
        crit: false,
        school: spell.school,
        ability: spell.name,
        kind: 'miss',
      });
      this.enterCombat(pet, target);
    } else {
      const dmg = Math.round(
        this.rng.range(spell.min + pet.level * 0.8, spell.max + pet.level * 1.1),
      );
      this.dealDamage(pet, target, Math.max(1, dmg), false, spell.school, spell.name, 'hit');
    }
    pet.swingTimer = spell.every;
  }

  private petPickTarget(pet: Entity, owner: Entity): Entity | null {
    if (pet.petMode === 'passive') return null;
    // Anti-AFK: an aggressive pet only proactively pulls fresh targets while its
    // owner is actually playing. An idle owner's pet still defends (engagingUs /
    // ownerOffense below) but cannot farm the area alone (hunter/warlock).
    const ownerMeta = this.players.get(owner.id);
    const ownerIdle =
      !ownerMeta || this.tickCount - ownerMeta.lastActiveTick > PET_OWNER_IDLE_TICKS;
    let best: Entity | null = null;
    let bestD = pet.petMode === 'aggressive' ? PET_AGGRESSIVE_RANGE : PET_ASSIST_RANGE;
    for (const m of this.entities.values()) {
      if (m.id === pet.id || m.dead || !this.isHostileTo(pet, m)) continue;
      const engagingUs =
        m.kind === 'mob' && (m.aggroTargetId === owner.id || m.aggroTargetId === pet.id);
      const ownerOffense =
        owner.targetId === m.id &&
        (owner.autoAttack || (m.kind === 'mob' && m.threat.has(owner.id)));
      const aggressive =
        pet.petMode === 'aggressive' &&
        !ownerIdle &&
        dist2d(pet.pos, m.pos) <= PET_AGGRESSIVE_RANGE;
      if (!engagingUs && !ownerOffense && !aggressive) continue;
      const d = dist2d(pet.pos, m.pos);
      if (d < bestD) {
        best = m;
        bestD = d;
      }
    }
    return best;
  }

  // Step `e` one tick toward `dest`. With `ignoreObstacles`, the mover phases
  // straight through props — used to free a stuck evader, never for normal
  // locomotion. Returns true on arrival.
  private moveToward(e: Entity, dest: Vec3, speed: number, ignoreObstacles = false): boolean {
    const d = dist2d(e.pos, dest);
    if (d < 0.3) return true;
    const desired = angleTo(e.pos, dest);
    e.facing = desired;
    const step = Math.min(speed * DT, d);
    const canSwim = this.mobCanSwim(MOBS[e.templateId]);

    if (ignoreObstacles) {
      const nx = e.pos.x + Math.sin(desired) * step;
      const nz = e.pos.z + Math.cos(desired) * step;
      e.pos.x = nx;
      e.pos.z = nz;
      const g = groundHeight(nx, nz, this.cfg.seed);
      e.pos.y = Math.max(g, SWIM_SURFACE_Y); // ride the surface while phasing, don't sink under terrain/water
      return d - step < 0.3;
    }
    // Mobs have no nav mesh. Try the straight path first; only if a prop or the
    // waterline eats it do we fan the heading out and take the best slide AROUND
    // the obstacle. That lets a mob round the camp props to reach its target
    // instead of pinning on them. Open-ground movers take the first branch.
    let bestX = e.pos.x,
      bestZ = e.pos.z,
      bestProgress = 1e-3;
    for (const off of MOVE_SLIDE_FAN) {
      const a = desired + off;
      const nx = e.pos.x + Math.sin(a) * step;
      const nz = e.pos.z + Math.cos(a) * step;
      // landlocked creatures stop at the waterline instead of walking under it
      if (!canSwim && groundHeight(nx, nz, this.cfg.seed) < WATER_LEVEL - SWIM_DEPTH) continue;
      const r = this.resolveMovePoint(nx, nz, BODY_RADIUS, e);
      const progress = d - Math.hypot(r.x - dest.x, r.z - dest.z);
      if (progress > bestProgress) {
        bestProgress = progress;
        bestX = r.x;
        bestZ = r.z;
      }
      if (off === 0 && progress >= step - 1e-3) break; // straight path is clear
    }
    e.pos.x = bestX;
    e.pos.z = bestZ;
    const g = groundHeight(bestX, bestZ, this.cfg.seed);
    e.pos.y = canSwim && g < WATER_LEVEL - SWIM_DEPTH ? SWIM_SURFACE_Y : g;
    return dist2d(e.pos, dest) < 0.3;
  }

  // blockedTowardSpawn moved to mob/locomotion.ts (M2; called only by the evade arm).

  private respawnMob(mob: Entity): void {
    if (mob.ownerId !== null) {
      this.despawnPersistentPet(mob);
      return;
    }
    this.clearNonPlayerStatAuras(mob);
    mob.dead = false;
    mob.lootable = false;
    mob.loot = null;
    mob.lootRecipientIds = undefined;
    mob.tappedById = null;
    mob.ownerId = null;
    mob.hostile = true;
    mob.pos = { ...mob.spawnPos };
    mob.pos.y = groundHeight(mob.pos.x, mob.pos.z, this.cfg.seed);
    mob.prevPos = { ...mob.pos };
    this.rebucket(mob);
    mob.hp = mob.maxHp;
    mob.auras = [];
    mob.aiState = 'idle';
    mob.aggroTargetId = null;
    mob.inCombat = false;
    if (mob.templateId === NYTHRAXIS_BOSS_ID) {
      mob.facing = Math.PI;
      mob.prevFacing = Math.PI;
    }
    mob.leashAnchor = null;
    mob.evadeStall = 0;
    mob.fleeTimer = 0;
    mob.fleeReturnTimer = 0;
    mob.hasFled = false;
    clearThreat(mob);
    this.despawnSummonedAdds(mob);
    mob.firedSummons = 0;
    mob.enraged = false;
    mob.healedThisPull = false;
    mob.stompTimer = MOBS[mob.templateId]?.stomp?.every ?? 0;
    mob.terrifyTimer = MOBS[mob.templateId]?.terrify?.every ?? 0;
    mob.mendTimer = MOBS[mob.templateId]?.mendAlly?.every ?? 0;
    mob.wardTimer = MOBS[mob.templateId]?.wardAllies?.every ?? 0;
    mob.stoneskinTimer = MOBS[mob.templateId]?.stoneskin?.every ?? 0;
    mob.rallyTimer = MOBS[mob.templateId]?.rally?.every ?? 0;
    mob.warcryTimer = MOBS[mob.templateId]?.warcry?.every ?? 0;
    mob.wanderTimer = this.rng.range(2, 8);
    if (mob.templateId === NYTHRAXIS_BOSS_ID) this.resetNythraxisEncounter(mob);
    for (const meta of this.players.values()) {
      const e = this.entities.get(meta.entityId);
      if (e && e.targetId === mob.id) e.targetId = null;
    }
  }

  // Encounter reset: remove the adds a boss summoned this pull so retries
  // start clean (firedSummons re-fires a fresh wave per pull). Player
  // target/combo refs are cleared first, like freeInstance does.
  private despawnSummonedAdds(boss: Entity): void {
    if (boss.summonedIds.length === 0) return;
    for (const id of boss.summonedIds) {
      if (!this.entities.has(id)) continue;
      for (const meta of this.players.values()) {
        const e = this.entities.get(meta.entityId);
        if (e?.targetId === id) e.targetId = null;
        if (e?.comboTargetId === id) {
          e.comboTargetId = null;
          e.comboPoints = 0;
        }
      }
      this.dropEntity(id);
    }
    boss.summonedIds = [];
  }

  // Classic beast "Frenzy": when a mob carrying the packFrenzy trait dies, the
  // surviving same-family hostile mobs nearby briefly attack faster. Modelled as
  // a refreshable buff_haste aura, so it rides the normal aura tick (expires on
  // its own) and the existing snapshot wire — no new Entity field is needed.
  private frenzyPackmates(dead: Entity): void {
    const fr = MOBS[dead.templateId]?.packFrenzy;
    if (!fr) return;
    const r2 = fr.radius * fr.radius;
    this.grid.forEachInRadius(dead.pos.x, dead.pos.z, fr.radius, (m, d2) => {
      if (m.id === dead.id || m.kind !== 'mob' || m.dead || m.aiState === 'dead') return;
      if (!m.hostile || m.ownerId !== null || d2 > r2) return;
      // packmates = same creature type (a wolf pack), matching the social-aggro convention
      if (m.templateId !== dead.templateId) return;
      const existing = m.auras.find((a) => a.id === PACK_FRENZY_AURA_ID);
      if (existing) {
        existing.remaining = fr.duration; // refresh on each further loss; don't stack
        return;
      }
      m.auras.push({
        id: PACK_FRENZY_AURA_ID,
        name: 'Pack Frenzy',
        kind: 'buff_haste',
        remaining: fr.duration,
        duration: fr.duration,
        value: fr.hasteMult,
        sourceId: m.id,
        school: 'physical',
      });
      this.emit({ type: 'aura', targetId: m.id, name: 'Pack Frenzy', gained: true });
      this.emit({
        type: 'log',
        text: `${m.name} flies into a frenzy!`,
        color: '#ff8c00',
        entityId: m.id,
      });
      this.emit({
        type: 'spellfx',
        sourceId: m.id,
        targetId: m.id,
        school: 'physical',
        fx: 'nova',
      });
    });
  }

  // Death Throes (arm): a volatile creature does not explode the instant it
  // dies. Its corpse destabilizes for `delay` seconds — a telegraph players can
  // run from — by arming a fuse that the corpse tick (updateMob) counts down.
  private armDeathThroes(dead: Entity): void {
    const dt = MOBS[dead.templateId]?.deathThroes;
    if (!dt) return;
    dead.detonateTimer = dt.delay;
    const school = dt.school ?? 'nature';
    this.emit({ type: 'spellfx', sourceId: dead.id, targetId: dead.id, school, fx: 'nova' });
    this.emit({
      type: 'log',
      text: `${dead.name} begins to swell — get clear!`,
      color: '#9acd32',
      entityId: dead.id,
    });
  }

  // Death Throes (detonate): the corpse bursts for min..max `school` damage to
  // every living player within `radius`. Mirrors the aoePulse damage loop; the
  // dead mob is the damage source so credit/threat resolve as a normal hit.
  private detonateCorpse(dead: Entity): void {
    const dt = MOBS[dead.templateId]?.deathThroes;
    if (!dt) return;
    const school = dt.school ?? 'nature';
    this.emit({ type: 'spellfx', sourceId: dead.id, targetId: dead.id, school, fx: 'nova' });
    this.emit({
      type: 'log',
      text: `${dead.name} bursts in a cloud of ${dt.name}!`,
      color: '#9acd32',
      entityId: dead.id,
    });
    for (const meta of this.players.values()) {
      const pe = this.entities.get(meta.entityId);
      if (pe && !pe.dead && dist2d(pe.pos, dead.pos) <= dt.radius) {
        const dmg = Math.round(this.rng.range(dt.min, dt.max));
        this.dealDamage(dead, pe, dmg, false, school, dt.name, 'hit', true);
      }
    }
  }

  // Boss threshold mechanics: add waves (summonAdds) and enrage. Checked
  // every tick while the boss is in combat; thresholds fire once per pull
  // and reset on evade/respawn.
  private updateBossMechanics(mob: Entity): void {
    const tmpl = MOBS[mob.templateId];
    if (
      !tmpl ||
      (!tmpl.summonAdds &&
        !tmpl.enrage &&
        !tmpl.desperateHeal &&
        !tmpl.mendAlly &&
        !tmpl.wardAllies &&
        !tmpl.rally &&
        !tmpl.warcry)
    )
      return;
    const hpFrac = mob.hp / Math.max(1, mob.maxHp);
    if (tmpl.summonAdds) {
      const thresholds = tmpl.summonAdds.atHpPct;
      while (mob.firedSummons < thresholds.length && hpFrac <= thresholds[mob.firedSummons]) {
        mob.firedSummons++;
        const run = this.delveRunForMob(mob.id);
        if (
          run &&
          this.findDelveObject(run, 'cracked_grave') &&
          this.startDelveRaiseDeadChannel(run, mob, tmpl.summonAdds.mobId, tmpl.summonAdds.count)
        )
          continue;
        this.spawnBossAdds(mob, tmpl.summonAdds.mobId, tmpl.summonAdds.count);
      }
    }
    // Delve bosses enrage on Heroic only (PRD delves.md §7.4: "Heroic: optional
    // enrage below 20% HP"). World bosses have no delve run, so they enrage as
    // before. Only resolved for enrage-capable templates, so the lookup is rare.
    const enrageRun = tmpl.enrage ? this.delveRunForMob(mob.id) : null;
    const enrageAllowed = !enrageRun || enrageRun.tierId === 'heroic';
    if (tmpl.enrage && enrageAllowed && !mob.enraged && hpFrac <= tmpl.enrage.belowHpPct) {
      mob.enraged = true;
      this.emit({ type: 'aura', targetId: mob.id, name: 'Enrage', gained: true });
      this.emit({
        type: 'log',
        text: `${mob.name} becomes enraged!`,
        color: '#ff6666',
        entityId: mob.id,
      });
      this.emit({
        type: 'spellfx',
        sourceId: mob.id,
        targetId: mob.id,
        school: 'fire',
        fx: 'nova',
      });
    }
    if (tmpl.desperateHeal && !mob.healedThisPull && hpFrac <= tmpl.desperateHeal.belowHpPct) {
      mob.healedThisPull = true;
      const heal = Math.min(mob.maxHp - mob.hp, Math.round(mob.maxHp * tmpl.desperateHeal.healPct));
      if (heal > 0) {
        mob.hp += heal;
        this.emit({ type: 'heal', targetId: mob.id, amount: heal });
        this.emit({
          type: 'log',
          text: `${mob.name} draws on a desperate second wind!`,
          color: '#66ff99',
          entityId: mob.id,
        });
        this.emit({
          type: 'spellfx',
          sourceId: mob.id,
          targetId: mob.id,
          school: 'nature',
          fx: 'nova',
        });
      }
    }
    // Support "Mend": periodically heal every wounded friendly mob in range
    // (including the caster). Telegraphed via createMob seeding mendTimer to a
    // full interval, so the first cast never lands the instant combat opens.
    if (tmpl.mendAlly) {
      mob.mendTimer -= DT;
      if (mob.mendTimer <= 0) {
        mob.mendTimer = tmpl.mendAlly.every;
        const wounded: Entity[] = [];
        for (const ally of this.entities.values()) {
          if (ally.kind !== 'mob' || ally.dead || ally.ownerId !== null) continue; // skip players, pets, corpses
          if (ally.hostile !== mob.hostile || ally.hp >= ally.maxHp) continue; // only wounded same-faction mobs
          if (dist2d(ally.pos, mob.pos) > tmpl.mendAlly.radius) continue;
          wounded.push(ally);
        }
        if (wounded.length > 0) {
          const school = tmpl.mendAlly.school ?? 'nature';
          this.emit({ type: 'spellfx', sourceId: mob.id, targetId: mob.id, school, fx: 'nova' });
          this.emit({
            type: 'log',
            text: `${mob.name} channels ${tmpl.mendAlly.name}.`,
            color: '#66ff99',
            entityId: mob.id,
          });
          for (const ally of wounded) {
            const amount = Math.round(this.rng.range(tmpl.mendAlly.healMin, tmpl.mendAlly.healMax));
            this.applyHeal(mob, ally, amount, tmpl.mendAlly.name);
          }
        }
      }
    }
    // Support "Ward": the defensive twin of Mend. Periodically wrap every living
    // friendly mob in range (including the caster) in an absorb shield. Unlike
    // Mend it targets healthy allies too — a barrier pre-empts the next blows.
    // Refreshes each interval, replacing any partially-soaked ward (same aura id).
    if (tmpl.wardAllies) {
      mob.wardTimer -= DT;
      if (mob.wardTimer <= 0) {
        mob.wardTimer = tmpl.wardAllies.every;
        const allies: Entity[] = [];
        for (const ally of this.entities.values()) {
          if (ally.kind !== 'mob' || ally.dead || ally.ownerId !== null) continue; // skip players, pets, corpses
          if (ally.hostile !== mob.hostile) continue; // same-faction mobs only
          if (dist2d(ally.pos, mob.pos) > tmpl.wardAllies.radius) continue;
          allies.push(ally);
        }
        if (allies.length > 0) {
          const school = tmpl.wardAllies.school ?? 'holy';
          this.emit({ type: 'spellfx', sourceId: mob.id, targetId: mob.id, school, fx: 'nova' });
          this.emit({
            type: 'log',
            text: `${mob.name} channels ${tmpl.wardAllies.name}.`,
            color: '#aad4ff',
            entityId: mob.id,
          });
          for (const ally of allies) {
            this.applyAura(ally, {
              id: `ward_${mob.templateId}`,
              name: tmpl.wardAllies.name,
              kind: 'absorb',
              remaining: tmpl.wardAllies.duration,
              duration: tmpl.wardAllies.duration,
              value: tmpl.wardAllies.amount,
              sourceId: mob.id,
              school,
            });
          }
        }
      }
    }

    // Commander "Rally": periodically empower every friendly mob in range
    // (including the caster) with a refreshing attack-power buff. The offensive
    // twin of mendAlly — same telegraphed timer, same same-faction ally scan —
    // but it grants buff_ap (folded by effectiveAttackPower) instead of healing.
    if (tmpl.rally) {
      mob.rallyTimer -= DT;
      if (mob.rallyTimer <= 0) {
        mob.rallyTimer = tmpl.rally.every;
        const allies: Entity[] = [];
        for (const ally of this.entities.values()) {
          if (ally.kind !== 'mob' || ally.dead || ally.ownerId !== null) continue; // skip players, pets, corpses
          if (ally.hostile !== mob.hostile) continue; // only same-faction mobs
          if (dist2d(ally.pos, mob.pos) > tmpl.rally.radius) continue;
          allies.push(ally);
        }
        if (allies.length > 0) {
          const school = tmpl.rally.school ?? 'physical';
          this.emit({ type: 'spellfx', sourceId: mob.id, targetId: mob.id, school, fx: 'nova' });
          this.emit({
            type: 'log',
            text: `${mob.name} unleashes ${tmpl.rally.name}!`,
            color: '#ffcc33',
            entityId: mob.id,
          });
          for (const ally of allies) {
            this.applyAura(ally, {
              id: `rally_${mob.templateId}`,
              name: tmpl.rally.name,
              kind: 'buff_ap',
              remaining: tmpl.rally.duration,
              duration: tmpl.rally.duration,
              value: tmpl.rally.ap,
              sourceId: mob.id,
              school,
            });
          }
        }
      }
    }
    // Support "War Cadence": periodically quicken every nearby friendly mob's
    // swings (including the caster) by re-applying a refreshing buff_haste aura.
    // Same telegraph as Mend; rides swingIntervalMult's existing buff_haste fold.
    if (tmpl.warcry) {
      mob.warcryTimer -= DT;
      if (mob.warcryTimer <= 0) {
        mob.warcryTimer = tmpl.warcry.every;
        const allies: Entity[] = [];
        for (const ally of this.entities.values()) {
          if (ally.kind !== 'mob' || ally.dead || ally.ownerId !== null) continue; // skip players, pets, corpses
          if (ally.hostile !== mob.hostile) continue; // same-faction only
          if (dist2d(ally.pos, mob.pos) > tmpl.warcry.radius) continue;
          allies.push(ally);
        }
        if (allies.length > 0) {
          const school = tmpl.warcry.school ?? 'physical';
          const auraId = `warcry_${mob.templateId}`;
          this.emit({ type: 'spellfx', sourceId: mob.id, targetId: mob.id, school, fx: 'nova' });
          this.emit({
            type: 'log',
            text: `${mob.name} channels ${tmpl.warcry.name}.`,
            color: '#ffd27f',
            entityId: mob.id,
          });
          for (const ally of allies) {
            const existing = ally.auras.find((a) => a.id === auraId);
            if (existing) {
              existing.remaining = tmpl.warcry.duration; // refresh on each pulse; never stack
              continue;
            }
            ally.auras.push({
              id: auraId,
              name: tmpl.warcry.name,
              kind: 'buff_haste',
              remaining: tmpl.warcry.duration,
              duration: tmpl.warcry.duration,
              value: tmpl.warcry.hasteMult,
              sourceId: mob.id,
              school,
            });
            this.emit({ type: 'aura', targetId: ally.id, name: tmpl.warcry.name, gained: true });
          }
        }
      }
    }
  }

  private initNythraxisEncounter(boss: Entity): NonNullable<Entity['nythraxis']> {
    if (!boss.nythraxis) {
      boss.nythraxis = {
        phase: 1,
        introSpoken: false,
        transitionStarted: false,
        transitionTimer: 0,
        transitionCues: [],
        transitionReleased: false,
        dialogueBusyUntil: 0,
        dialogueToken: 0,
        gravebreakerTimer: 1.5,
        gravebreakerCasts: 0,
        raiseFallenTimer: NYTHRAXIS_RAISE_FALLEN_EVERY,
        soulRendTimer: NYTHRAXIS_SOUL_REND_EVERY,
        soulRendMarks: [],
        soulRendLockout: 0,
        deathlessTimer: NYTHRAXIS_DEATHLESS_EVERY,
        deathlessCastRemaining: 0,
        deathlessStunRemaining: 0,
        wardChannels: [],
        finalStand: false,
        deathSpoken: false,
      };
    }
    return boss.nythraxis;
  }

  private resetNythraxisEncounter(boss: Entity): void {
    for (const p of this.playersInNythraxisRoom(boss)) {
      p.auras = p.auras.filter(
        (a) => a.id !== 'nythraxis_soul_rend' && a.id !== 'nythraxis_transition_stun',
      );
      this.clearNythraxisWardChannelCast(p);
    }
    for (const e of this.nythraxisTransitionStunTargets(boss)) {
      if (e.kind !== 'player')
        e.auras = e.auras.filter((a) => a.id !== 'nythraxis_transition_stun');
    }
    const aldric = this.findNythraxisAldric(boss);
    if (aldric) this.dropEntity(aldric.id);
    for (const ward of this.nythraxisDeathlessChannelObjects(boss)) {
      ward.auras = ward.auras.filter((a) => a.id !== 'nythraxis_wardstone_lit');
    }
    boss.nythraxis = undefined;
    boss.castingAbility = null;
    boss.castRemaining = 0;
    boss.castTotal = 0;
    boss.channeling = false;
  }

  // Full wipe: every player in the arena is dead. Send Nythraxis home at full
  // health, clear his adds/Aldric/wards/auras, and drop combat so the sealed
  // doors reopen and the raid can run back in for another attempt.
  private wipeNythraxisEncounter(boss: Entity): void {
    boss.pos = { ...boss.spawnPos };
    boss.prevPos = { ...boss.spawnPos };
    this.rebucket(boss);
    this.resetEvadingMob(boss); // restores hp, clears threat/auras/adds + resetNythraxisEncounter
  }

  private updateNythraxisEncounter(boss: Entity): void {
    const st = this.initNythraxisEncounter(boss);
    if (!st.introSpoken) {
      st.introSpoken = true;
      this.nythraxisDialogueSet(boss, [
        { speaker: 'nythraxis', text: 'Another kingdom comes to challenge me', delay: 0 },
        {
          speaker: 'nythraxis',
          text: 'You will join the rest',
          delay: NYTHRAXIS_OPENER_SECOND_YELL_DELAY,
        },
      ]);
    }

    // Wipe-or-kill is the only reset: if every player in the arena is dead the
    // encounter resets for a retry; otherwise keep the boss locked onto a live
    // target so kiting him out of melee never sends him home.
    const room = this.playersInNythraxisRoom(boss);
    if (room.length === 0) {
      this.wipeNythraxisEncounter(boss);
      return;
    }
    const tgt = boss.aggroTargetId !== null ? this.entities.get(boss.aggroTargetId) : null;
    if (
      !tgt ||
      tgt.dead ||
      tgt.kind !== 'player' ||
      dist2d(tgt.pos, boss.spawnPos) > NYTHRAXIS_ROOM_RADIUS
    ) {
      const topId = threatEntries(boss, 1)[0]?.[0] ?? null;
      const top = topId !== null ? this.entities.get(topId) : null;
      const next = top && !top.dead && top.kind === 'player' ? top : room[0];
      boss.aggroTargetId = next.id;
      boss.inCombat = true;
      if (boss.aiState === 'idle' || boss.aiState === 'evade') boss.aiState = 'chase';
    }
    if (boss.aggroTargetId !== null && (boss.aiState === 'idle' || boss.aiState === 'evade')) {
      boss.inCombat = true;
      boss.aiState = 'chase';
    }

    if (st.soulRendLockout > 0) st.soulRendLockout = Math.max(0, st.soulRendLockout - DT);
    this.updateNythraxisSoulRend(boss, st);
    if (st.phase === 'transition') {
      this.updateNythraxisTransition(boss, st);
      return;
    }
    if (st.phase === 'dead') return;

    const hpFrac = boss.hp / Math.max(1, boss.maxHp);
    if (st.phase === 1 && hpFrac <= NYTHRAXIS_PHASE_TWO_HP) {
      this.startNythraxisTransition(boss, st);
      return;
    }

    if (st.phase === 2 && !st.finalStand && hpFrac <= NYTHRAXIS_FINAL_STAND_HP) {
      st.finalStand = true;
      boss.enraged = true;
      this.nythraxisDialogueSet(boss, [
        { speaker: 'nythraxis', text: 'I built a kingdom', delay: 0 },
        {
          speaker: 'nythraxis',
          text: 'I will not lose it again',
          delay: NYTHRAXIS_DIALOGUE_LINE_SECONDS,
        },
      ]);
      this.applyAura(boss, {
        id: 'nythraxis_final_stand',
        name: 'Final Stand',
        kind: 'buff_haste',
        remaining: 600,
        duration: 600,
        value: 1.45,
        sourceId: boss.id,
        school: 'shadow',
      });
      this.emit({
        type: 'spellfx',
        sourceId: boss.id,
        targetId: boss.id,
        school: 'shadow',
        fx: 'nova',
      });
    }

    if (st.deathlessStunRemaining > 0) {
      st.deathlessStunRemaining = Math.max(0, st.deathlessStunRemaining - DT);
      return;
    }
    if (st.deathlessCastRemaining > 0) {
      this.updateNythraxisDeathlessRage(boss, st);
      return;
    }

    this.updateNythraxisGravebreaker(boss, st);
    if (st.phase === 1) this.updateNythraxisRaiseFallen(boss, st);
    if (st.phase === 2) {
      st.soulRendTimer -= DT;
      if (st.soulRendTimer <= 0) {
        if (this.canCastNythraxisSoulRend(st)) this.castNythraxisSoulRend(boss, st);
        else st.soulRendTimer = 1;
      }
      st.deathlessTimer -= DT;
      if (st.deathlessTimer <= 0) {
        if (st.soulRendMarks.length === 0 && st.soulRendLockout <= 0)
          this.startNythraxisDeathlessRage(boss, st);
        else st.deathlessTimer = 1;
      }
    }
  }

  private reserveNythraxisDialogue(
    boss: Entity,
    duration: number,
    critical = false,
    queue = false,
  ): { st: NonNullable<Entity['nythraxis']>; token: number } | null {
    const st = this.initNythraxisEncounter(boss);
    const busyUntil = st.dialogueBusyUntil ?? 0;
    if (!critical && busyUntil > this.time && !queue) return null;
    const delay = !critical && queue && busyUntil > this.time ? busyUntil - this.time : 0;
    const token = (st.dialogueToken ?? 0) + 1;
    st.dialogueToken = token;
    st.dialogueBusyUntil = this.time + delay + duration;
    return { st, token };
  }

  private nythraxisDialogueSet(
    boss: Entity,
    lines: { speaker: 'nythraxis' | 'aldric'; text: string; delay: number }[],
    critical = false,
    queue = false,
  ): boolean {
    if (lines.length === 0) return true;
    const duration = Math.max(...lines.map((line) => line.delay)) + NYTHRAXIS_DIALOGUE_LINE_SECONDS;
    const busyUntil = boss.nythraxis?.dialogueBusyUntil ?? 0;
    const startDelay = !critical && queue && busyUntil > this.time ? busyUntil - this.time : 0;
    const reservation = this.reserveNythraxisDialogue(boss, duration, critical, queue);
    if (!reservation) return false;
    const { st, token } = reservation;
    for (const line of lines) {
      const delay = startDelay + line.delay;
      if (delay <= 0) {
        this.emitNythraxisYell(boss, line.speaker, line.text);
        continue;
      }
      this.delayedEvents.push({
        at: this.time + delay,
        event: this.nythraxisYellEvent(boss, line.speaker, line.text),
        guard: () => critical || st.dialogueToken === token,
      });
    }
    return true;
  }

  private nythraxisSay(
    boss: Entity,
    speaker: 'nythraxis' | 'aldric',
    text: string,
    critical = false,
  ): boolean {
    const reservation = this.reserveNythraxisDialogue(
      boss,
      NYTHRAXIS_DIALOGUE_LINE_SECONDS,
      critical,
    );
    if (!reservation) return false;
    this.emitNythraxisYell(boss, speaker, text);
    return true;
  }

  private nythraxisYellEvent(
    boss: Entity,
    speaker: 'nythraxis' | 'aldric',
    text: string,
  ): SimEvent {
    const actor = speaker === 'aldric' ? this.findNythraxisAldric(boss) : boss;
    const from = actor?.name ?? (speaker === 'aldric' ? 'Brother Aldric' : boss.name);
    const fromPid = actor?.id ?? boss.id;
    return { type: 'chat', fromPid, from, text, channel: 'yell', entityId: actor?.id ?? boss.id };
  }

  private emitNythraxisYell(boss: Entity, speaker: 'nythraxis' | 'aldric', text: string): void {
    const event = this.nythraxisYellEvent(boss, speaker, text);
    for (const meta of this.players.values()) {
      const p = this.entities.get(meta.entityId);
      if (!p || dist2d(p.pos, boss.pos) > YELL_RANGE) continue;
      this.emit({ ...event, pid: meta.entityId });
    }
  }

  private findNythraxisAldric(boss: Entity): Entity | null {
    for (const e of this.entities.values()) {
      if (
        e.templateId === NYTHRAXIS_ALDRIC_ID &&
        !e.dead &&
        dist2d(e.spawnPos, boss.spawnPos) < NYTHRAXIS_ROOM_RADIUS
      )
        return e;
    }
    return null;
  }

  private playersInNythraxisRoom(boss: Entity): Entity[] {
    const out: Entity[] = [];
    for (const meta of this.players.values()) {
      const p = this.entities.get(meta.entityId);
      if (p && !p.dead && dist2d(p.pos, boss.spawnPos) <= NYTHRAXIS_ROOM_RADIUS) out.push(p);
    }
    out.sort((a, b) => a.id - b.id);
    return out;
  }

  private nythraxisTransitionStunTargets(boss: Entity): Entity[] {
    return [...this.entities.values()].filter(
      (e) =>
        !e.dead &&
        dist2d(e.pos, boss.spawnPos) <= NYTHRAXIS_ROOM_RADIUS &&
        (e.kind === 'player' ||
          (e.kind === 'mob' && (e.templateId === NYTHRAXIS_ADD_ID || e.ownerId !== null))),
    );
  }

  private nythraxisRoomMetas(boss: Entity): PlayerMeta[] {
    const out: PlayerMeta[] = [];
    for (const meta of this.players.values()) {
      const p = this.entities.get(meta.entityId);
      if (p && dist2d(p.pos, boss.spawnPos) <= NYTHRAXIS_ROOM_RADIUS) out.push(meta);
    }
    out.sort((a, b) => a.entityId - b.entityId);
    return out;
  }

  private grantNythraxisLockout(boss: Entity): void {
    const until = this.lockoutNowMs() + NYTHRAXIS_LOCKOUT_MS;
    for (const meta of this.nythraxisRoomMetas(boss)) {
      meta.raidLockouts.set('nythraxis_boss_arena', until);
    }
  }

  private updateNythraxisGravebreaker(boss: Entity, st: NonNullable<Entity['nythraxis']>): void {
    st.gravebreakerTimer -= DT;
    if (st.gravebreakerTimer > 0) return;
    st.gravebreakerTimer = NYTHRAXIS_GRAVEBREAKER_EVERY;
    st.gravebreakerCasts = (st.gravebreakerCasts ?? 0) + 1;
    if (st.gravebreakerCasts % 3 === 0)
      this.nythraxisSay(boss, 'nythraxis', 'Kneel before your king');
    this.emit({
      type: 'spellfx',
      sourceId: boss.id,
      targetId: boss.id,
      school: 'physical',
      fx: 'nova',
    });
    let rawDmg =
      this.rng.range(boss.weapon.min, boss.weapon.max) +
      (this.effectiveAttackPower(boss) / 14) * boss.weapon.speed;
    const enrage = MOBS[boss.templateId]?.enrage;
    if (boss.enraged && enrage) rawDmg *= enrage.dmgMult;
    for (const p of this.playersInNythraxisRoom(boss)) {
      const d = dist2d(p.pos, boss.pos);
      if (d > NYTHRAXIS_GRAVEBREAKER_RANGE) continue;
      const delta = Math.abs(normAngle(angleTo(boss.pos, p.pos) - boss.facing));
      if (delta > NYTHRAXIS_GRAVEBREAKER_HALF_ARC) continue;
      const mult = p.id === boss.aggroTargetId ? 1 : 1.5;
      const mitigated = rawDmg * mult * (1 - armorReduction(this.effectiveArmor(p), boss.level));
      const dmg = Math.max(1, Math.round(mitigated));
      this.dealDamage(boss, p, dmg, false, 'physical', 'Gravebreaker', 'hit', true);
    }
  }

  private updateNythraxisRaiseFallen(boss: Entity, st: NonNullable<Entity['nythraxis']>): void {
    st.raiseFallenTimer -= DT;
    if (st.raiseFallenTimer > 0) return;
    st.raiseFallenTimer = NYTHRAXIS_RAISE_FALLEN_EVERY;
    this.nythraxisDialogueSet(boss, [
      { speaker: 'nythraxis', text: 'Rise once more', delay: 0 },
      {
        speaker: 'nythraxis',
        text: 'Your king commands it',
        delay: NYTHRAXIS_DIALOGUE_LINE_SECONDS,
      },
    ]);
    this.spawnNythraxisAdds(boss);
  }

  private spawnNythraxisAdds(boss: Entity): void {
    const template = MOBS[NYTHRAXIS_ADD_ID];
    if (!template) return;
    // Raise the guards from BEHIND the boss (toward the back wall), so they rise
    // up behind him and march out around him, not between the boss and the raid.
    const back = boss.spawnPos.z + 16;
    const spawnPoints = [
      this.groundPos(boss.spawnPos.x - 12, back),
      this.groundPos(boss.spawnPos.x + 12, back),
    ];
    const inst = this.instances.find((i) => i.partyKey !== null && i.mobIds.includes(boss.id));
    const victimId = boss.aggroTargetId ?? threatEntries(boss, 1)[0]?.[0] ?? null;
    const victim = victimId !== null ? this.entities.get(victimId) : null;
    for (const pos of spawnPoints) {
      const add = createMob(this.nextId++, template, template.maxLevel, pos);
      add.spawnPos = { ...boss.spawnPos };
      add.tappedById = boss.tappedById;
      this.addEntity(add);
      boss.summonedIds.push(add.id);
      inst?.mobIds.push(add.id);
      if (victim && !victim.dead && victim.kind === 'player') this.aggroMob(add, victim, false);
    }
    this.emit({
      type: 'spellfx',
      sourceId: boss.id,
      targetId: boss.id,
      school: 'shadow',
      fx: 'nova',
    });
  }

  private startNythraxisTransition(boss: Entity, st: NonNullable<Entity['nythraxis']>): void {
    st.phase = 'transition';
    st.transitionStarted = true;
    const queuedDialogueDelay = Math.max(0, (st.dialogueBusyUntil ?? 0) - this.time);
    st.transitionTimer = NYTHRAXIS_TRANSITION_DURATION + queuedDialogueDelay;
    st.transitionReleased = false;
    st.soulRendMarks = [];
    st.deathlessCastRemaining = 0;
    boss.castingAbility = null;
    boss.castRemaining = 0;
    boss.castTotal = 0;
    const transitionLines = [
      { speaker: 'nythraxis' as const, text: 'Another priest...', delay: 0 },
      { speaker: 'aldric' as const, text: 'Your kingdom is gone, Nythraxis', delay: 3.0 },
      { speaker: 'aldric' as const, text: 'Yet you still cling to it', delay: 5.7 },
      { speaker: 'aldric' as const, text: 'Champions, listen carefully!', delay: 8.4 },
      { speaker: 'aldric' as const, text: 'The wardstones still bind his soul.', delay: 11.2 },
      { speaker: 'aldric' as const, text: 'When the time comes, do not ignore them.', delay: 14.1 },
      { speaker: 'aldric' as const, text: 'Fail and we all perish', delay: 17.1 },
    ];
    this.emit({
      type: 'spellfx',
      sourceId: boss.id,
      targetId: boss.id,
      school: 'physical',
      fx: 'nova',
    });
    for (const e of this.nythraxisTransitionStunTargets(boss)) {
      this.applyAura(e, {
        id: 'nythraxis_transition_stun',
        name: 'War Stomp',
        kind: 'stun',
        remaining: NYTHRAXIS_TRANSITION_STUN,
        duration: NYTHRAXIS_TRANSITION_STUN,
        value: 0,
        sourceId: boss.id,
        school: 'physical',
      });
    }
    this.applyAura(boss, {
      id: 'nythraxis_transition_pause',
      name: 'War Stomp',
      kind: 'stun',
      remaining: NYTHRAXIS_TRANSITION_STUN,
      duration: NYTHRAXIS_TRANSITION_STUN,
      value: 0,
      sourceId: boss.id,
      school: 'physical',
    });
    this.spawnNythraxisAldric(boss);
    this.lightNythraxisWardstones(boss);
    this.nythraxisDialogueSet(boss, transitionLines, false, true);
    st.transitionCues = [];
  }

  private spawnNythraxisAldric(boss: Entity): void {
    if (this.findNythraxisAldric(boss)) return;
    // Brother Aldric is a friendly quest NPC, not a mob: modeling him as an NPC
    // lets the online client mirror his questIds and open the turn-in dialog
    // (createMob produced a friendly mob the client could never interact with).
    const def = NPCS[NYTHRAXIS_ALDRIC_ID];
    if (!def) return;
    const aldric = createNpc(
      this.nextId++,
      def,
      this.groundPos(boss.spawnPos.x, boss.spawnPos.z - NYTHRAXIS_ALDRIC_SPAWN_DIST),
    );
    aldric.level = boss.level; // createNpc defaults to 10; match the boss's level for the nameplate
    aldric.hostile = false;
    aldric.facing = 0;
    aldric.prevFacing = 0;
    aldric.spawnPos = { ...aldric.pos };
    this.addEntity(aldric);
    const inst = this.instances.find((i) => i.partyKey !== null && i.mobIds.includes(boss.id));
    inst?.mobIds.push(aldric.id);
  }

  private updateNythraxisTransition(boss: Entity, st: NonNullable<Entity['nythraxis']>): void {
    const aldric = this.findNythraxisAldric(boss);
    if (aldric) {
      const dest = this.groundPos(boss.spawnPos.x, boss.spawnPos.z - NYTHRAXIS_ALDRIC_WALK_DIST);
      this.moveToward(aldric, dest, aldric.moveSpeed);
    }
    st.transitionTimer -= DT;
    if (st.transitionTimer > 0) return;
    st.phase = 2;
    st.transitionReleased = true;
    st.gravebreakerTimer = 3;
    st.soulRendTimer = NYTHRAXIS_PHASE_TWO_SETTLE_DELAY;
    st.deathlessTimer = NYTHRAXIS_PHASE_TWO_SETTLE_DELAY + 15;
    boss.auras = boss.auras.filter((a) => a.id !== 'nythraxis_transition_pause');
    for (const e of this.nythraxisTransitionStunTargets(boss)) {
      e.auras = e.auras.filter((a) => a.id !== 'nythraxis_transition_stun');
    }
  }

  private lightNythraxisWardstones(boss: Entity): void {
    for (const ward of this.nythraxisDeathlessChannelObjects(boss)) {
      this.applyAura(ward, {
        id: 'nythraxis_wardstone_lit',
        name: 'Soul Ward',
        kind: 'absorb',
        remaining: 600,
        duration: 600,
        value: 1,
        sourceId: boss.id,
        school: 'arcane',
      });
      this.emit({
        type: 'spellfx',
        sourceId: ward.id,
        targetId: boss.id,
        school: 'arcane',
        fx: 'projectile',
      });
    }
  }

  private canCastNythraxisSoulRend(st: NonNullable<Entity['nythraxis']>): boolean {
    return st.deathlessCastRemaining <= 0 && st.deathlessStunRemaining <= 0;
  }

  private castNythraxisSoulRend(boss: Entity, st: NonNullable<Entity['nythraxis']>): void {
    const candidates = this.playersInNythraxisRoom(boss).filter((p) => p.id !== boss.aggroTargetId);
    if (candidates.length === 0) {
      st.soulRendTimer = 3;
      return;
    }
    const picked: Entity[] = [];
    while (picked.length < 3 && candidates.length > 0) {
      const idx = this.rng.int(0, candidates.length - 1);
      picked.push(candidates.splice(idx, 1)[0]);
    }
    st.soulRendMarks = picked.map((p) => ({
      playerId: p.id,
      remaining: NYTHRAXIS_SOUL_REND_DURATION,
    }));
    st.soulRendTimer = NYTHRAXIS_SOUL_REND_EVERY;
    this.nythraxisSay(boss, 'nythraxis', 'Your spirit belongs to me', true);
    for (const p of picked) {
      this.applyAura(p, {
        id: 'nythraxis_soul_rend',
        name: 'Soul Rend',
        kind: 'vulnerability',
        remaining: NYTHRAXIS_SOUL_REND_DURATION,
        duration: NYTHRAXIS_SOUL_REND_DURATION,
        value: 0,
        sourceId: boss.id,
        school: 'shadow',
      });
      this.emit({
        type: 'spellfx',
        sourceId: boss.id,
        targetId: p.id,
        school: 'shadow',
        fx: 'projectile',
      });
    }
  }

  private updateNythraxisSoulRend(boss: Entity, st: NonNullable<Entity['nythraxis']>): void {
    if (st.soulRendMarks.length === 0) return;
    for (const mark of st.soulRendMarks) mark.remaining -= DT;
    if (st.soulRendMarks.some((m) => m.remaining > 0)) return;
    const marked = st.soulRendMarks
      .map((m) => this.entities.get(m.playerId))
      .filter((e): e is Entity => !!e && e.kind === 'player' && !e.dead);
    for (const p of marked) {
      const stacked = marked.filter(
        (other) => dist2d(other.pos, p.pos) <= NYTHRAXIS_SOUL_REND_STACK_RANGE,
      ).length;
      const share = Math.max(1, stacked);
      this.dealDamage(
        boss,
        p,
        Math.ceil(p.maxHp / share),
        false,
        'shadow',
        'Soul Rend',
        'hit',
        true,
      );
      p.auras = p.auras.filter((a) => a.id !== 'nythraxis_soul_rend');
      this.emit({
        type: 'spellfx',
        sourceId: boss.id,
        targetId: p.id,
        school: 'shadow',
        fx: 'nova',
      });
    }
    st.soulRendMarks = [];
  }

  private startNythraxisDeathlessRage(boss: Entity, st: NonNullable<Entity['nythraxis']>): void {
    st.deathlessTimer = NYTHRAXIS_DEATHLESS_EVERY;
    st.deathlessCastRemaining = NYTHRAXIS_DEATHLESS_CAST;
    st.soulRendLockout = NYTHRAXIS_DEATHLESS_SOUL_REND_LOCKOUT;
    st.wardChannels = this.nythraxisDeathlessChannelObjects(boss).map((ward) => ({
      objectId: ward.id,
      playerId: null,
      remaining: NYTHRAXIS_DEATHLESS_CHANNEL,
      complete: false,
    }));
    boss.castingAbility = 'nythraxis_deathless_rage';
    boss.castTotal = NYTHRAXIS_DEATHLESS_CAST;
    boss.castRemaining = NYTHRAXIS_DEATHLESS_CAST;
    boss.channeling = false;
    this.nythraxisSay(boss, 'nythraxis', 'Witness true eternity!', true);
    this.emit({
      type: 'spellfx',
      sourceId: boss.id,
      targetId: boss.id,
      school: 'shadow',
      fx: 'nova',
    });
  }

  private updateNythraxisDeathlessRage(boss: Entity, st: NonNullable<Entity['nythraxis']>): void {
    st.deathlessCastRemaining = Math.max(0, st.deathlessCastRemaining - DT);
    boss.castingAbility = 'nythraxis_deathless_rage';
    boss.castTotal = NYTHRAXIS_DEATHLESS_CAST;
    boss.castRemaining = st.deathlessCastRemaining;
    this.updateNythraxisWardChannels(boss, st);
    if (this.nythraxisWardstoneInterruptReady(st)) {
      st.deathlessCastRemaining = 0;
      boss.castingAbility = null;
      boss.castRemaining = 0;
      boss.castTotal = 0;
      st.deathlessStunRemaining = NYTHRAXIS_DEATHLESS_STUN;
      this.applyAura(boss, {
        id: 'nythraxis_deathless_stun',
        name: 'Deathless Rage Interrupted',
        kind: 'stun',
        remaining: NYTHRAXIS_DEATHLESS_STUN,
        duration: NYTHRAXIS_DEATHLESS_STUN,
        value: 0,
        sourceId: boss.id,
        school: 'arcane',
      });
      this.emit({
        type: 'spellfx',
        sourceId: boss.id,
        targetId: boss.id,
        school: 'arcane',
        fx: 'nova',
      });
      return;
    }
    if (st.deathlessCastRemaining > 0) return;
    boss.castingAbility = null;
    boss.castRemaining = 0;
    boss.castTotal = 0;
    this.nythraxisSay(boss, 'nythraxis', 'You cannot stop what was promised..', true);
    this.emit({
      type: 'spellfx',
      sourceId: boss.id,
      targetId: boss.id,
      school: 'shadow',
      fx: 'nova',
    });
    for (const p of this.playersInNythraxisRoom(boss)) {
      this.dealDamage(
        boss,
        p,
        Math.ceil(p.maxHp * 0.82),
        false,
        'shadow',
        'Deathless Rage',
        'hit',
        true,
      );
    }
  }

  private nythraxisWardstoneInterruptReady(st: NonNullable<Entity['nythraxis']>): boolean {
    if (
      st.wardChannels.length === 0 ||
      !st.wardChannels.every((c) => c.complete && c.playerId !== null)
    )
      return false;
    return new Set(st.wardChannels.map((c) => c.playerId)).size === st.wardChannels.length;
  }

  private updateNythraxisWardChannels(boss: Entity, st: NonNullable<Entity['nythraxis']>): void {
    for (const channel of st.wardChannels) {
      if (channel.complete || channel.playerId === null) continue;
      const ward = this.entities.get(channel.objectId);
      const p = this.entities.get(channel.playerId);
      if (
        !ward ||
        !p ||
        p.dead ||
        isStunned(p) ||
        dist2d(p.pos, ward.pos) > INTERACT_RANGE + 1
      ) {
        if (p) this.clearNythraxisWardChannelCast(p);
        channel.playerId = null;
        channel.remaining = NYTHRAXIS_DEATHLESS_CHANNEL;
        continue;
      }
      channel.remaining = Math.max(0, channel.remaining - DT);
      p.castingAbility = 'nythraxis_ward_channel';
      p.channeling = true;
      p.castTotal = NYTHRAXIS_DEATHLESS_CHANNEL;
      p.castRemaining = channel.remaining;
      this.emit({
        type: 'spellfx',
        sourceId: ward.id,
        targetId: boss.id,
        school: 'shadow',
        fx: 'beam',
      });
      if (channel.remaining <= 0) {
        channel.complete = true;
        this.clearNythraxisWardChannelCast(p);
        this.emit({
          type: 'spellfx',
          sourceId: ward.id,
          targetId: boss.id,
          school: 'arcane',
          fx: 'nova',
        });
      }
    }
  }

  private clearNythraxisWardChannelCast(p: Entity): void {
    if (p.castingAbility !== 'nythraxis_ward_channel') return;
    p.castingAbility = null;
    p.channeling = false;
    p.castRemaining = 0;
    p.castTotal = 0;
  }

  private nythraxisWardstones(boss: Entity): Entity[] {
    const wards = [...this.entities.values()].filter(
      (e) =>
        e.kind === 'object' &&
        e.objectItemId === NYTHRAXIS_WARDSTONE_ITEM_ID &&
        dist2d(e.pos, boss.spawnPos) < NYTHRAXIS_WARDSTONE_RANGE,
    );
    wards.sort((a, b) => a.id - b.id);
    return wards;
  }

  private nythraxisDeathlessChannelObjects(boss: Entity): Entity[] {
    return this.nythraxisWardstones(boss);
  }

  private tryStartNythraxisWardChannel(ward: Entity, player: Entity): boolean {
    if (ward.objectItemId !== NYTHRAXIS_WARDSTONE_ITEM_ID) return false;
    const boss = [...this.entities.values()].find(
      (e) =>
        e.kind === 'mob' &&
        e.templateId === NYTHRAXIS_BOSS_ID &&
        !e.dead &&
        dist2d(e.spawnPos, ward.pos) < NYTHRAXIS_WARDSTONE_RANGE,
    );
    // No Nythraxis boss in range: this is not a raid wardstone but the overworld
    // "Sunken Bastion" quest ward stone (same item id). Fall through so the normal
    // quest pickup runs, instead of swallowing the interaction.
    if (!boss) return false;
    if (!boss.nythraxis || boss.nythraxis.deathlessCastRemaining <= 0) return true;
    const channel = boss.nythraxis.wardChannels.find((c) => c.objectId === ward.id);
    if (!channel || channel.complete) return true;
    if (channel.playerId === player.id) return true;
    if (channel.playerId !== null && channel.playerId !== player.id) return true;
    channel.playerId = player.id;
    channel.remaining = NYTHRAXIS_DEATHLESS_CHANNEL;
    player.castingAbility = 'nythraxis_ward_channel';
    player.channeling = true;
    player.castTotal = NYTHRAXIS_DEATHLESS_CHANNEL;
    player.castRemaining = NYTHRAXIS_DEATHLESS_CHANNEL;
    this.emit({
      type: 'spellfx',
      sourceId: ward.id,
      targetId: boss.id,
      school: 'shadow',
      fx: 'beam',
    });
    return true;
  }

  private spawnBossAdds(boss: Entity, mobId: string, count: number): void {
    const template = MOBS[mobId];
    if (!template) return;
    this.emit({
      type: 'log',
      text: `${boss.name} calls for aid!`,
      color: '#ff6666',
      entityId: boss.id,
    });
    this.emit({
      type: 'spellfx',
      sourceId: boss.id,
      targetId: boss.id,
      school: 'shadow',
      fx: 'nova',
    });
    // adds spawned inside a claimed instance despawn with it
    const delveRun = this.delveRunForMob(boss.id);
    const inst = this.instances.find((i) => {
      if (i.partyKey === null) return false;
      const o = this.instanceOriginOf(i);
      return Math.abs(boss.pos.x - o.x) < 120 && Math.abs(boss.pos.z - o.z) < 250;
    });
    const [topThreatId] = threatEntries(boss, 1)[0] ?? [];
    const victimId = boss.aggroTargetId ?? topThreatId ?? null;
    const victim = victimId !== null ? this.entities.get(victimId) : null;
    for (let k = 0; k < count; k++) {
      const ang = (k / count) * Math.PI * 2 + 0.7;
      const pos = this.groundPos(
        boss.pos.x + Math.sin(ang) * 3.5,
        boss.pos.z + Math.cos(ang) * 3.5,
      );
      const level = this.rng.int(template.minLevel, template.maxLevel);
      const add = createMob(this.nextId++, template, level, pos);
      add.spawnPos = { ...boss.spawnPos }; // leashes with the boss; stays dead in instances
      add.tappedById = boss.tappedById;
      this.addEntity(add);
      boss.summonedIds.push(add.id);
      inst?.mobIds.push(add.id);
      delveRun?.mobIds.push(add.id);
      if (victim && !victim.dead && victim.kind === 'player') {
        add.aggroTargetId = victim.id;
        add.inCombat = true;
        add.aiState = dist2d(add.pos, victim.pos) > this.mobMeleeRange(add) ? 'chase' : 'attack';
        addThreat(add, victim.id, 1);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Targeting
  // -------------------------------------------------------------------------

  targetEntity(id: number | null, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const p = r.e;
    // switching to a different target ends a follow (re-targeting is manual intent)
    if (p.followTargetId !== null && id !== p.followTargetId)
      this.stopFollow(p, 'You stop following.');
    if (id === null) {
      p.targetId = null;
      p.autoAttack = false;
      return;
    }
    const e = this.entities.get(id);
    if (!e || (e.dead && !e.lootable)) return;
    p.targetId = id;
    if (!this.isHostileTo(p, e) || e.dead) p.autoAttack = false;
  }

  tabTarget(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const p = r.e;
    const candidates = this.enemyCandidates(p);
    if (candidates.length === 0) return;
    // Cycle the enemies the player can see / is fighting first; off-screen ones
    // stay reachable but never steal the selection (see tab_target.ts).
    const { ids, primaryCount } = orderTabTargets(
      candidates.map((c) => ({
        id: c.e.id,
        dx: c.e.pos.x - p.pos.x,
        dz: c.e.pos.z - p.pos.z,
        d: c.d,
        engaged: c.e.aggroTargetId === p.id || c.e.targetId === p.id,
      })),
      p.facing,
    );
    const curIdx = ids.indexOf(p.targetId ?? -1);
    if (curIdx === -1) {
      // No (or no longer valid) target: grab the priority enemy, cluster first.
      p.targetId = ids[0];
    } else if (curIdx < primaryCount) {
      // Cycling the near fight cluster: wrap back to its first (priority) mob
      // instead of stepping out to a distant idle enemy still in range.
      p.targetId = ids[(curIdx + 1) % primaryCount];
    } else {
      // Sitting on a distant fallback target: walk the rest of the fallback,
      // then wrap back into the near cluster.
      const next = curIdx + 1;
      p.targetId = next < ids.length ? ids[next] : ids[0];
    }
  }

  targetNearestEnemy(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const p = r.e;
    let best: Entity | null = null;
    let bestD2 = TAB_QUERY_RADIUS * TAB_QUERY_RADIUS;
    this.grid.forEachInRadius(p.pos.x, p.pos.z, TAB_QUERY_RADIUS, (e, d2) => {
      if (!this.isEnemyTargetCandidate(p, e)) return;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    });
    if (best) p.targetId = (best as Entity).id;
  }

  private enemyCandidates(p: Entity): { e: Entity; d: number }[] {
    const out: { e: Entity; d: number }[] = [];
    if (p.dead) return out;
    this.grid.forEachInRadius(p.pos.x, p.pos.z, TAB_QUERY_RADIUS, (e, d2) => {
      if (!this.isEnemyTargetCandidate(p, e)) return;
      out.push({ e, d: Math.sqrt(d2) });
    });
    return out;
  }

  private isEnemyTargetCandidate(attacker: Entity, target: Entity): boolean {
    if (attacker.dead) return false;
    if (target.id === attacker.id || target.dead) return false;
    if (this.isHostileTo(attacker, target)) return true;
    if (target.kind === 'mob' && target.ownerId !== null) {
      const owner = this.entities.get(target.ownerId);
      return !!owner && owner.kind === 'player' && this.isEnemyTargetCandidate(attacker, owner);
    }
    if (target.kind !== 'player') return false;
    const attackerPlayer = this.pvpController(attacker);
    if (!attackerPlayer || attackerPlayer.dead) return false;
    const match = this.arenaMatches.get(attackerPlayer.id);
    return (
      !!match &&
      match.state === 'countdown' &&
      this.isArenaCrossTeam(match, attackerPlayer.id, target.id)
    );
  }

  // Nearby allies a beneficial spell can land on: other players (and friendly
  // pets) within range, never yourself, never dead/hostile. Mirrors the enemy
  // targeting helpers so heals/buffs are reachable by keyboard, not just by
  // clicking party frames or world models (#133).
  private friendlyCandidates(p: Entity): { e: Entity; d: number }[] {
    const out: { e: Entity; d: number }[] = [];
    this.grid.forEachInRadius(p.pos.x, p.pos.z, 40, (e, d2) => {
      if (e.id === p.id || e.dead || !this.isFriendlyTo(p, e)) return;
      out.push({ e, d: Math.sqrt(d2) });
    });
    return out;
  }

  targetNearestFriendly(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const p = r.e;
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const c of this.friendlyCandidates(p)) {
      if (c.d < bestD) {
        bestD = c.d;
        best = c.e;
      }
    }
    if (best) p.targetId = best.id;
  }

  friendlyTabTarget(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const p = r.e;
    const candidates = this.friendlyCandidates(p);
    if (candidates.length === 0) return;
    candidates.sort((a, b) => a.d - b.d);
    const curIdx = candidates.findIndex((c) => c.e.id === p.targetId);
    const next = candidates[(curIdx + 1) % candidates.length];
    p.targetId = next.e.id;
  }

  // -------------------------------------------------------------------------
  // Inventory, items, vendor
  // -------------------------------------------------------------------------

  countItem(itemId: string, pid?: number): number {
    const r = this.resolve(pid);
    if (!r) return 0;
    let n = 0;
    for (const s of r.meta.inventory) if (s.itemId === itemId) n += s.count;
    return n;
  }

  addItem(itemId: string, count: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta } = r;
    const def = ITEMS[itemId];
    const existing = meta.inventory.find((s) => s.itemId === itemId);
    if (existing) existing.count += count;
    else meta.inventory.push({ itemId, count });
    this.emit({
      type: 'loot',
      // biome-ignore lint/style/useTemplate: keep this scanner-friendly shape for i18n extraction.
      text: `You receive: ${def?.name ?? itemId}${count > 1 ? ' x' + count : ''}.`,
      pid: meta.entityId,
    });
    this.ctx.onInventoryChangedForQuests(meta);
    if (meta.autoEquip && (def?.kind === 'weapon' || def?.kind === 'armor')) {
      this.maybeAutoEquip(itemId, meta);
    }
  }

  removeItem(itemId: string, count: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta } = r;
    for (let i = meta.inventory.length - 1; i >= 0 && count > 0; i--) {
      const s = meta.inventory[i];
      if (s.itemId !== itemId) continue;
      const take = Math.min(s.count, count);
      s.count -= take;
      count -= take;
      if (s.count <= 0) meta.inventory.splice(i, 1);
    }
    this.ctx.onInventoryChangedForQuests(meta);
  }

  discardItem(itemId: string, count = 1, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta } = r;
    const def = ITEMS[itemId];
    const available = this.countItem(itemId, meta.entityId);
    if (!def || available <= 0) {
      this.error(meta.entityId, "You don't have that item.");
      return;
    }
    if (def.noDiscard) return;
    const discardCount = Number.isFinite(count) ? Math.min(Math.floor(count), available) : 0;
    if (discardCount <= 0) return;
    this.removeItem(itemId, discardCount, meta.entityId);
    this.emit({
      type: 'log',
      // biome-ignore lint/style/useTemplate: keep this scanner-friendly shape for i18n extraction.
      text: `Discarded ${def.name}${discardCount > 1 ? ' x' + discardCount : ''}.`,
      color: '#999',
      pid: meta.entityId,
    });
  }

  equipItem(itemId: string, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    const def = ITEMS[itemId];
    if (!def?.slot || (def.kind !== 'weapon' && def.kind !== 'armor')) return;
    if (this.countItem(itemId, meta.entityId) <= 0) return;
    if (!canEquipItem(meta.cls, def)) {
      this.error(meta.entityId, 'You cannot equip that.');
      return;
    }
    const slot = def.slot;
    const old = meta.equipment[slot];
    this.removeItem(itemId, 1, meta.entityId);
    if (old) this.addItemSilent(old, 1, meta);
    meta.equipment[slot] = itemId;
    recalcPlayerStats(p, meta.cls, meta.equipment, this.playerMods(meta));
    this.emit({ type: 'log', text: `Equipped ${def.name}.`, color: '#8f8', pid: meta.entityId });
  }

  // Remove the piece in `slot` back to the bags, leaving the slot empty. Unlike
  // equipItem (which only swaps in a replacement) this is the way to fully
  // unequip. Bags are uncapped, so the returned item never has nowhere to go.
  unequipItem(slot: EquipSlot, pid?: number): boolean {
    const r = this.resolve(pid);
    if (!r) return false;
    const { meta, e: p } = r;
    const itemId = meta.equipment[slot];
    if (!itemId) return false;
    delete meta.equipment[slot];
    // addItemSilent (not addItem): returning a piece you already owned to bags is
    // not a fresh acquisition, so it must not fire collect-quest credit. No quest
    // today keys on an unequip, so there is nothing to award here regardless.
    this.addItemSilent(itemId, 1, meta);
    recalcPlayerStats(p, meta.cls, meta.equipment, this.playerMods(meta));
    const def = ITEMS[itemId];
    this.emit({
      type: 'log',
      text: `Unequipped ${def?.name ?? itemId}.`,
      color: '#8f8',
      pid: meta.entityId,
    });
    return true;
  }

  private hasFishableWaterAhead(p: Entity): boolean {
    const sin = Math.sin(p.facing);
    const cos = Math.cos(p.facing);
    return FISHING_SAMPLE_DISTANCES.some(
      (d) =>
        groundHeight(p.pos.x + sin * d, p.pos.z + cos * d, this.cfg.seed) <
        WATER_LEVEL - SWIM_DEPTH,
    );
  }

  private isAtDeepfenShallowsFishingSpot(p: Entity): boolean {
    const d = Math.hypot(p.pos.x - DEEPFEN_SHALLOWS_LAKE.x, p.pos.z - DEEPFEN_SHALLOWS_LAKE.z);
    return d <= DEEPFEN_SHALLOWS_LAKE.radius + DEEPFEN_FISHING_SHORE_MARGIN;
  }

  private shouldCatchCodfather(p: Entity, meta: PlayerMeta): boolean {
    const qp = meta.questLog.get(THE_CODFATHER_QUEST_ID);
    return (
      qp?.state === 'active' &&
      this.countItem(THE_CODFATHER_ITEM_ID, meta.entityId) === 0 &&
      this.isAtDeepfenShallowsFishingSpot(p)
    );
  }

  private startFishing(p: Entity, meta: PlayerMeta): void {
    if (p.dead) {
      this.error(meta.entityId, "You can't do that while dead.");
      return;
    }
    if (p.inCombat) {
      this.error(meta.entityId, "You can't do that while in combat.");
      return;
    }
    if (this.isSwimming(p)) {
      this.error(meta.entityId, "You can't do that while swimming.");
      return;
    }
    if (p.castingAbility || isConsuming(p)) {
      this.error(meta.entityId, 'You are busy.');
      return;
    }
    if (!this.hasFishableWaterAhead(p)) {
      this.error(meta.entityId, 'You need to face fishable water.');
      return;
    }
    if (p.sitting) this.standUp(p);
    p.castingAbility = FISHING_CAST_ID;
    p.castTotal = FISHING_CAST_TIME;
    p.castRemaining = FISHING_CAST_TIME;
    p.channeling = false;
    this.emit({
      type: 'castStart',
      entityId: p.id,
      ability: FISHING_CAST_ID,
      time: FISHING_CAST_TIME,
    });
  }

  private completeFishing(p: Entity, meta: PlayerMeta): void {
    if (this.shouldCatchCodfather(p, meta)) {
      this.addItem(THE_CODFATHER_ITEM_ID, 1, meta.entityId);
      return;
    }
    // The catch depends on which zone's water you're fishing — each has its own
    // weighted table (src/sim/content/items.ts). Fall back to the Vale table for
    // any spot without its own (e.g. fishable water inside a dungeon zone).
    const table = FISHING_TABLES[zoneAt(p.pos.z).id] ?? FISHING_TABLES.eastbrook_vale;
    const total = table.reduce((sum, e) => sum + e.weight, 0);
    let roll = this.rng.next() * total;
    let caught: string | null = null;
    for (const entry of table) {
      roll -= entry.weight;
      if (roll < 0) {
        caught = entry.itemId;
        break;
      }
    }
    if (caught === null) {
      this.emit({ type: 'log', text: 'No fish are biting.', color: '#999', pid: p.id });
      return;
    }
    if (caught === FISHING_RARE_ID) {
      this.emit({
        type: 'log',
        text: 'A rare catch! Something gleams on your line.',
        color: '#1eff00',
        pid: p.id,
      });
    }
    this.addItem(caught, 1, meta.entityId);
  }

  useItem(itemId: string, pid?: number): ItemUseResult | undefined {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    const def = ITEMS[itemId];
    if (!def) return;
    if (this.countItem(itemId, meta.entityId) <= 0) {
      this.error(meta.entityId, "You don't have that item.");
      return;
    }
    if (def.use?.type === 'fishing') {
      this.startFishing(p, meta);
      return;
    }
    if (def.use?.type === 'mechChroma') {
      return this.unlockMechChromaFromItem(meta, itemId, def.use.chromaId);
    }
    if (def.use?.type === 'skinSelect') {
      this.openSkinSelect(meta, def.use.catalog ?? 'class', itemId);
      return;
    }
    if (p.castingAbility === FISHING_CAST_ID) {
      this.error(meta.entityId, 'You are busy.');
      return;
    }
    if (p.dead) return;
    if (def.kind === 'food' || def.kind === 'drink') {
      if (p.inCombat) {
        this.error(meta.entityId, "You can't do that while in combat.");
        return;
      }
      if (this.isSwimming(p)) {
        this.error(meta.entityId, "You can't do that while swimming.");
        return;
      }
      this.removeItem(itemId, 1, meta.entityId);
      p.sitting = true;
      // food and drink occupy separate slots, so you can do both at once
      const slot = def.kind === 'food' ? 'eating' : 'drinking';
      p[slot] = {
        itemId,
        kind: def.kind,
        hpPer2s: def.foodHp ? Math.round(def.foodHp / CONSUME_TICKS) : 0,
        manaPer2s: def.drinkMana ? Math.round(def.drinkMana / CONSUME_TICKS) : 0,
        remaining: CONSUME_DURATION,
      };
      this.emit({
        type: 'log',
        text: def.kind === 'food' ? 'You sit down to eat.' : 'You sit down to drink.',
        color: '#999',
        pid: meta.entityId,
      });
    } else if (def.kind === 'potion') {
      // instant, usable in combat, on a shared 60s cooldown (#103)
      if (this.time < p.potionCooldownUntil) {
        this.error(meta.entityId, 'That potion is not ready yet.');
        return;
      }
      const restoresMana =
        (def.potionMana ?? 0) > 0 && p.resourceType === 'mana' && p.resource < p.maxResource;
      const restoresHp = (def.potionHp ?? 0) > 0 && p.hp < p.maxHp;
      if (!restoresHp && !restoresMana) {
        this.error(
          meta.entityId,
          p.hp >= p.maxHp && (def.potionMana ?? 0) === 0
            ? 'You are already at full health.'
            : 'Nothing to restore.',
        );
        return;
      }
      this.removeItem(itemId, 1, meta.entityId);
      p.potionCooldownUntil = this.time + POTION_COOLDOWN;
      if (restoresHp) {
        const heal = Math.min(Math.round(def.potionHp! * this.healingTakenMult(p)), p.maxHp - p.hp);
        p.hp += heal;
        this.emit({ type: 'heal', targetId: p.id, amount: heal });
      }
      if (restoresMana) {
        p.resource = Math.min(p.maxResource, p.resource + def.potionMana!);
      }
      this.emit({ type: 'log', text: `You quaff ${def.name}.`, color: '#c9f', pid: meta.entityId });
    } else if (def.kind === 'elixir') {
      // Battle elixir: grant a temporary stat-buff aura. Usable in combat (classic),
      // no shared potion cooldown; re-quaffing refreshes the buff via applyAura.
      const elx = def.elixir;
      if (!elx) return;
      this.removeItem(itemId, 1, meta.entityId);
      this.applyAura(p, {
        id: `elixir_${itemId}`,
        name: elx.aura,
        kind: elx.kind,
        remaining: elx.duration,
        duration: elx.duration,
        value: elx.value,
        sourceId: p.id,
        school: 'nature',
      });
      this.emit({ type: 'log', text: `You quaff ${def.name}.`, color: '#c9f', pid: meta.entityId });
    } else if (def.kind === 'weapon' || def.kind === 'armor') {
      this.equipItem(itemId, meta.entityId);
    }
  }

  buyItem(npcId: number, itemId: string, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    const npc = this.entities.get(npcId);
    const def = ITEMS[itemId];
    if (npc?.kind !== 'npc' || npc.vendorItems.length === 0) {
      this.error(meta.entityId, 'That merchant is not available.');
      return;
    }
    if (!npc.vendorItems.includes(itemId)) {
      this.error(meta.entityId, 'That item is not sold here.');
      return;
    }
    if (!def?.buyValue) {
      this.error(meta.entityId, 'That item is not for sale.');
      return;
    }
    if (dist2d(p.pos, npc.pos) > INTERACT_RANGE + 2) {
      this.error(meta.entityId, 'Too far away.');
      return;
    }
    if (meta.copper < def.buyValue) {
      this.error(meta.entityId, 'Not enough money.');
      return;
    }
    meta.copper -= def.buyValue;
    this.addItem(itemId, 1, meta.entityId);
    this.emit({ type: 'vendor', action: 'buy', itemId, pid: meta.entityId });
  }

  private vendorInRange(p: Entity): boolean {
    return [...this.entities.values()].some(
      (e) =>
        e.kind === 'npc' && e.vendorItems.length > 0 && dist2d(p.pos, e.pos) <= INTERACT_RANGE + 2,
    );
  }

  private recordVendorBuyback(meta: PlayerMeta, itemId: string, count: number): void {
    const existingIndex = meta.vendorBuyback.findIndex((s) => s.itemId === itemId);
    if (existingIndex >= 0) {
      const [existing] = meta.vendorBuyback.splice(existingIndex, 1);
      existing.count += count;
      meta.vendorBuyback.unshift(existing);
    } else {
      meta.vendorBuyback.unshift({ itemId, count });
    }
    while (meta.vendorBuyback.length > VENDOR_BUYBACK_LIMIT) meta.vendorBuyback.pop();
  }

  sellItem(itemId: string, count = 1, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    const def = ITEMS[itemId];
    const available = this.countItem(itemId, meta.entityId);
    if (!def || available <= 0) {
      this.error(meta.entityId, "You don't have that item.");
      return;
    }
    if (p.dead) {
      this.error(meta.entityId, "You can't do that while dead.");
      return;
    }
    const sellCount = Number.isFinite(count) ? Math.min(Math.floor(count), available) : 0;
    if (sellCount <= 0) return;
    if (!this.vendorInRange(p)) {
      this.error(meta.entityId, 'There is no merchant nearby.');
      return;
    }
    if (def.noVendorSell) {
      this.error(meta.entityId, 'That item is not for sale.');
      return;
    }
    if (def.kind === 'quest') {
      this.error(meta.entityId, 'You cannot sell quest items.');
      return;
    }
    this.removeItem(itemId, sellCount, meta.entityId);
    this.recordVendorBuyback(meta, itemId, sellCount);
    const payout = def.sellValue * sellCount;
    meta.copper += payout;
    this.emit({ type: 'vendor', action: 'sell', itemId, pid: meta.entityId });
    this.emit({
      type: 'loot',
      // biome-ignore lint/style/useTemplate: keep this scanner-friendly shape for i18n extraction.
      text: `Sold ${def.name}${sellCount > 1 ? ' x' + sellCount : ''} for ${formatMoney(payout)}.`,
      pid: meta.entityId,
    });
  }

  // Bulk-sell every gray (poor-quality) item in the bags in one action, applying the
  // same rules as the per-item sellItem path: quest items and noVendorSell items are
  // left untouched and each sold stack is recorded for buyback. One summary loot line
  // is emitted instead of one per stack.
  sellAllJunk(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    if (p.dead) {
      this.error(meta.entityId, "You can't do that while dead.");
      return;
    }
    if (!this.vendorInRange(p)) {
      this.error(meta.entityId, 'There is no merchant nearby.');
      return;
    }
    const junk = meta.inventory
      .filter((s) => {
        const def = ITEMS[s.itemId];
        return (
          !!def &&
          def.quality === 'poor' &&
          def.kind !== 'quest' &&
          !def.noVendorSell &&
          s.count > 0
        );
      })
      .map((s) => ({ itemId: s.itemId, count: s.count }));
    if (junk.length === 0) return; // nothing gray to sell; the vendor UI keeps the button disabled here
    let total = 0;
    let soldCount = 0;
    for (const { itemId, count } of junk) {
      const def = ITEMS[itemId]!;
      this.removeItem(itemId, count, meta.entityId);
      this.recordVendorBuyback(meta, itemId, count);
      total += def.sellValue * count;
      soldCount += count;
    }
    meta.copper += total;
    this.emit({ type: 'vendor', action: 'sell', pid: meta.entityId });
    this.emit({
      type: 'loot',
      text: `Sold ${soldCount} junk item${soldCount === 1 ? '' : 's'} for ${formatMoney(total)}.`,
      pid: meta.entityId,
    });
  }

  buyBackItem(itemId: string, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    const def = ITEMS[itemId];
    const slot = meta.vendorBuyback.find((s) => s.itemId === itemId);
    if (!def || !slot || slot.count <= 0) {
      this.error(meta.entityId, 'That item is not available for buyback.');
      return;
    }
    if (p.dead) {
      this.error(meta.entityId, "You can't do that while dead.");
      return;
    }
    if (!this.vendorInRange(p)) {
      this.error(meta.entityId, 'There is no merchant nearby.');
      return;
    }
    if (meta.copper < def.sellValue) {
      this.error(meta.entityId, 'Not enough money.');
      return;
    }
    meta.copper -= def.sellValue;
    slot.count -= 1;
    if (slot.count <= 0) meta.vendorBuyback = meta.vendorBuyback.filter((s) => s !== slot);
    this.addItemSilent(itemId, 1, meta);
    this.ctx.onInventoryChangedForQuests(meta);
    this.emit({ type: 'vendor', action: 'buyback', itemId, pid: meta.entityId });
    this.emit({
      type: 'loot',
      text: `Bought back ${def.name} for ${formatMoney(def.sellValue)}.`,
      pid: meta.entityId,
    });
  }

  private addItemSilent(itemId: string, count: number, meta: PlayerMeta): void {
    const existing = meta.inventory.find((s) => s.itemId === itemId);
    if (existing) existing.count += count;
    else meta.inventory.push({ itemId, count });
  }

  private maybeAutoEquip(itemId: string, meta: PlayerMeta): void {
    const def = ITEMS[itemId];
    if (!def?.slot) return;
    if (!canEquipItem(meta.cls, def)) return;
    if (def.kind === 'weapon') {
      const cur = meta.equipment.mainhand ? ITEMS[meta.equipment.mainhand]?.weapon : null;
      const next = def.weapon;
      if (next && (!cur || next.min + next.max > cur.min + cur.max))
        this.equipItem(itemId, meta.entityId);
    } else {
      const cur = meta.equipment[def.slot] ? ITEMS[meta.equipment[def.slot]!] : null;
      if (!cur || (def.stats?.armor ?? 0) > (cur.stats?.armor ?? 0))
        this.equipItem(itemId, meta.entityId);
    }
  }

  // -------------------------------------------------------------------------
  // Interaction: looting, quest NPCs, ground objects
  // -------------------------------------------------------------------------

  lootCorpse(mobId: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    const mob = this.entities.get(mobId);
    if (!mob?.lootable || !mob.loot) return;
    const tapperParty = mob.tappedById !== null ? this.partyOf(mob.tappedById) : null;
    const hasSharedLootRights =
      mob.tappedById === null ||
      mob.tappedById === meta.entityId ||
      !!tapperParty?.members.includes(meta.entityId);
    const hasPersonalLoot = mob.loot.items.some((s) => s.personalFor?.includes(meta.entityId));
    const hasOpenLoot = mob.loot.items.some((s) => s.openToAll && s.count > 0);
    if (!hasSharedLootRights && !hasPersonalLoot && !hasOpenLoot) {
      this.error(meta.entityId, "You don't have permission to loot that.");
      return;
    }
    if (dist2d(p.pos, mob.pos) > INTERACT_RANGE) {
      this.error(meta.entityId, 'Too far away.');
      return;
    }
    if (hasSharedLootRights) this.distributeLootCopper(mob, meta);
    for (const s of [...mob.loot.items]) {
      if (!this.lootSlotVisibleTo(s, meta.entityId)) continue;
      if (s.openToAll) {
        for (let i = 0; i < s.count; i++) this.addItem(s.itemId, 1, meta.entityId);
        s.count = 0;
        continue;
      }
      if (s.personalFor) {
        this.addItem(s.itemId, 1, meta.entityId);
        s.personalFor = s.personalFor.filter((id) => id !== meta.entityId);
        continue;
      }
      if (!hasSharedLootRights) continue;
      for (let i = 0; i < s.count; i++) {
        this.awardSharedLootItem(s.itemId, mob, meta);
      }
      s.count = 0;
    }
    this.pruneCorpseLoot(mob);
    if (p.targetId === mobId) p.targetId = null;
  }

  pickUpObject(objId: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    const obj = this.entities.get(objId);
    if (obj?.kind !== 'object' || !obj.lootable || !obj.objectItemId) return;
    if (dist2d(p.pos, obj.pos) > INTERACT_RANGE) {
      this.error(meta.entityId, 'Too far away.');
      return;
    }
    if (this.tryStartNythraxisWardChannel(obj, p)) return;
    if (this.activateNythraxisRelic(obj, meta)) return;
    if (this.interactObjectForQuests(obj, meta)) return;
    const def = ITEMS[obj.objectItemId];
    if (def?.questId) {
      const qp = meta.questLog.get(def.questId);
      if (!qp || (qp.state !== 'active' && qp.state !== 'ready')) {
        this.error(meta.entityId, def.pickupDeny ?? `You cannot take the ${def.name} yet.`);
        return;
      }
      const quest = QUESTS[def.questId];
      const objIdx = quest.objectives.findIndex(
        (o) => o.type === 'collect' && o.itemId === obj.objectItemId,
      );
      if (objIdx < 0) {
        this.error(meta.entityId, def.pickupEnough ?? `${def.name} offers nothing more.`);
        return;
      }
      if (
        objIdx >= 0 &&
        this.countItem(obj.objectItemId, meta.entityId) >= quest.objectives[objIdx].count
      ) {
        this.error(meta.entityId, def.pickupEnough ?? 'You have enough of those.');
        return;
      }
    }
    this.addItem(obj.objectItemId, 1, meta.entityId);
    obj.lootable = false;
    obj.respawnTimer = OBJECT_RESPAWN;
  }

  private activateNythraxisRelic(obj: Entity, meta: PlayerMeta): boolean {
    if (!obj.objectItemId) return false;
    const mobId = NYTHRAXIS_RELIC_SUMMONS[obj.objectItemId];
    if (!mobId) return false;
    const qp = meta.questLog.get('q_nythraxis_sealed_crypt');
    if (qp?.state !== 'active') {
      const def = ITEMS[obj.objectItemId];
      this.error(meta.entityId, def?.pickupDeny ?? 'The relic is bound by the sealed crypt.');
      return true;
    }
    const quest = QUESTS.q_nythraxis_sealed_crypt;
    const objectiveIndex = quest.objectives.findIndex(
      (o) => o.type === 'collect' && o.itemId === obj.objectItemId,
    );
    if (
      objectiveIndex >= 0 &&
      this.countItem(obj.objectItemId, meta.entityId) >= quest.objectives[objectiveIndex].count
    ) {
      const def = ITEMS[obj.objectItemId];
      this.error(meta.entityId, def?.pickupEnough ?? 'You have already recovered this relic.');
      return true;
    }
    this.summonQuestMob(mobId, obj.pos, meta.entityId);
    obj.lootable = false;
    obj.respawnTimer = OBJECT_RESPAWN;
    return true;
  }

  private interactObjectForQuests(obj: Entity, meta: PlayerMeta): boolean {
    if (!obj.objectItemId) return false;
    let handled = false;
    for (const qp of meta.questLog.values()) {
      if (qp.state !== 'active') continue;
      const quest = QUESTS[qp.questId];
      quest.objectives.forEach((objective, objectiveIndex) => {
        if (objective.type !== 'interact' || objective.targetObjectItemId !== obj.objectItemId)
          return;
        handled = true;
        const isRitual = obj.objectItemId === 'crypt_ritual_circle';
        if (isRitual && !this.countItem('crypt_keystone', meta.entityId)) {
          this.error(meta.entityId, 'The ritual circle is silent without the Crypt Keystone.');
          return;
        }
        // Re-summon the Bound Guardian whenever the player still owes the kill.
        // The interact objective is one-shot, but a guardian lost to the idle
        // despawn (leash, wipe) must stay reachable or the kill/collect/signet
        // dead-ends with no way to retry. summonQuestMob no-ops if one is alive.
        if (isRitual) {
          const killIdx = quest.objectives.findIndex(
            (o) => o.type === 'kill' && o.targetMobId === 'bound_guardian',
          );
          if (killIdx >= 0 && qp.counts[killIdx] < quest.objectives[killIdx].count) {
            this.summonQuestMob('bound_guardian', obj.pos, meta.entityId);
          }
        }
        // The interact objective itself (and its one-time vision) only credits once.
        if (qp.counts[objectiveIndex] >= objective.count) return;
        const shared = this.sharedNythraxisObjectParticipants(
          meta,
          obj,
          qp.questId,
          objectiveIndex,
        );
        for (const member of shared) {
          const memberQp = member.questLog.get(qp.questId);
          if (memberQp?.state !== 'active') continue;
          if (memberQp.counts[objectiveIndex] >= objective.count) continue;
          memberQp.counts[objectiveIndex]++;
          member.counters.questProgress++;
          this.emit({
            type: 'questProgress',
            questId: memberQp.questId,
            text: `${objective.label}: ${memberQp.counts[objectiveIndex]}/${objective.count}`,
            pid: member.entityId,
          });
          this.ctx.checkQuestReady(memberQp, member);
        }
        const visionId = this.summonQuestVision(obj.objectItemId, obj.pos);
        this.emitQuestObjectVision(
          obj.objectItemId,
          shared.map((m) => m.entityId),
          visionId,
        );
      });
    }
    return handled;
  }

  private sharedNythraxisObjectParticipants(
    actor: PlayerMeta,
    obj: Entity,
    questId: string,
    objectiveIndex: number,
  ): PlayerMeta[] {
    if (
      obj.objectItemId !== 'grave_sir_aldren' &&
      obj.objectItemId !== 'grave_high_priest_malric' &&
      obj.objectItemId !== 'grave_captain_voss' &&
      obj.objectItemId !== 'crypt_ritual_circle'
    ) {
      return [actor];
    }
    const quest = QUESTS[questId];
    const objective = quest.objectives[objectiveIndex];
    const party = this.partyOf(actor.entityId);
    const members = party ? party.members : [actor.entityId];
    const eligible: PlayerMeta[] = [];
    for (const pid of members) {
      const member = this.players.get(pid);
      const entity = this.entities.get(pid);
      const memberQp = member?.questLog.get(questId);
      if (!member || !entity || entity.dead || !memberQp || memberQp.state !== 'active') continue;
      if (memberQp.counts[objectiveIndex] >= objective.count) continue;
      if (dist2d(entity.pos, obj.pos) > NYTHRAXIS_PARTY_INTERACT_RANGE) continue;
      eligible.push(member);
    }
    return eligible.some((member) => member.entityId === actor.entityId) ? eligible : [actor];
  }

  private emitQuestObjectVision(itemId: string, pids: number[], entityId?: number | null): void {
    const lines =
      itemId === 'grave_sir_aldren'
        ? ['My king was a good man.', 'I swore my blade to him.', 'I would do so again.']
        : itemId === 'grave_high_priest_malric'
          ? [
              'There had to be another way.',
              'I could not let him die.',
              'I only wanted to save him.',
            ]
          : itemId === 'grave_captain_voss'
            ? [
                'The king was already dead.',
                'Malric refused to accept it.',
                'We should have let him rest.',
                'If you find the crypt... end this.',
              ]
            : itemId === 'crypt_ritual_circle'
              ? ['The Crypt Keystone turns cold as the seal breaks.']
              : null;
    if (!lines) return;
    for (let i = 0; i < lines.length; i++) {
      for (const pid of pids) {
        const event: SimEvent = {
          type: 'log',
          text: lines[i],
          color: '#b8d7ff',
          pid,
          entityId: entityId ?? undefined,
        };
        if (i === 0) this.emit(event);
        else this.delayedEvents.push({ at: this.time + i * NYTHRAXIS_VISION_LINE_DELAY, event });
      }
    }
  }

  private summonQuestVision(itemId: string, pos: Vec3): number | null {
    const templateId =
      itemId === 'grave_sir_aldren'
        ? 'vision_aldren_warrior'
        : itemId === 'grave_high_priest_malric'
          ? 'vision_malric_mage'
          : itemId === 'grave_captain_voss'
            ? 'vision_deathstalker_voss'
            : null;
    if (!templateId) return null;
    const existing = [...this.entities.values()].find(
      (e) => e.kind === 'mob' && e.templateId === templateId && !e.dead && dist2d(e.pos, pos) < 10,
    );
    if (existing) return existing.id;
    const template = MOBS[templateId];
    if (!template) return null;
    const mob = createMob(
      this.nextId++,
      template,
      template.maxLevel,
      this.groundPos(pos.x + 2.4, pos.z + 2.4),
    );
    mob.hostile = false;
    mob.aiState = 'idle';
    mob.lootable = false;
    mob.loot = null;
    mob.despawnTimer = 22;
    mob.facing = Math.PI;
    mob.prevFacing = mob.facing;
    mob.swingTimer = Infinity;
    this.addEntity(mob);
    return mob.id;
  }

  private summonQuestMob(templateId: string, pos: Vec3, ownerPid: number): void {
    const existing = [...this.entities.values()].some(
      (e) => e.kind === 'mob' && e.templateId === templateId && !e.dead && dist2d(e.pos, pos) < 18,
    );
    if (existing) return;
    const template = MOBS[templateId];
    if (!template) return;
    const mob = createMob(
      this.nextId++,
      template,
      template.maxLevel,
      this.groundPos(pos.x, pos.z + 3),
    );
    mob.facing = Math.PI;
    mob.prevFacing = mob.facing;
    mob.tappedById = ownerPid;
    this.addEntity(mob);
    const owner = this.entities.get(ownerPid);
    if (owner && owner.kind === 'player' && !owner.dead) this.aggroMob(mob, owner, false);
    const inst = this.instances.find((i) => {
      if (i.partyKey === null) return false;
      const origin = this.instanceOriginOf(i);
      return Math.abs(mob.pos.x - origin.x) < 120 && Math.abs(mob.pos.z - origin.z) < 250;
    });
    if (inst) inst.mobIds.push(mob.id);
    this.emit({ type: 'log', text: `${template.name} awakens!`, color: '#ff6666' });
    this.emitQuestMobDialogue(templateId, mob.id);
  }

  private emitQuestMobDialogue(templateId: string, entityId: number): void {
    const text =
      templateId === 'fallen_captain_aldren'
        ? 'Fallen Captain Aldren yells, "None shall disturb the king\'s rest! For Thornpeak!"'
        : templateId === 'corrupted_priest_malric'
          ? 'Corrupted Priest Malric yells, "Death shall never claim my king! The ritual must endure!"'
          : templateId === 'deathstalker_voss'
            ? 'Deathstalker Voss yells, "You will not reach him! The king must endure!"'
            : null;
    if (text) this.emit({ type: 'log', text, color: '#ff9999', entityId });
  }

  interact(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const p = r.e;
    if (p.targetId !== null) {
      const target = this.entities.get(p.targetId);
      if (target && dist2d(p.pos, target.pos) <= INTERACT_RANGE + 2) {
        if (target.kind === 'mob' && target.lootable) {
          this.lootCorpse(target.id, p.id);
          return;
        }
        if (target.kind === 'object' && target.lootable) {
          if (target.templateId === 'dungeon_door' && target.dungeonId) {
            this.enterDungeon(target.dungeonId, p.id);
            return;
          }
          if (target.templateId === 'dungeon_exit') {
            this.leaveDungeon(p.id);
            return;
          }
          if (this.tryStartNythraxisWardChannel(target, p)) return;
          this.pickUpObject(target.id, p.id);
          return;
        }
        if (this.isQuestInteractionEntity(target)) {
          this.talkToNpc(target.id, p.id);
          return;
        }
      }
    }
    let bestCorpse: Entity | null = null;
    let bestCorpseD2 = INTERACT_RANGE * INTERACT_RANGE;
    let bestObj: Entity | null = null;
    let bestObjD2 = INTERACT_RANGE * INTERACT_RANGE;
    let bestQuestEntity: Entity | null = null;
    let bestQuestD2 = INTERACT_RANGE * INTERACT_RANGE;
    this.grid.forEachInRadius(p.pos.x, p.pos.z, INTERACT_RANGE, (e, d2) => {
      if (e.kind === 'mob' && e.lootable && d2 < bestCorpseD2) {
        bestCorpse = e;
        bestCorpseD2 = d2;
      }
      if (e.kind === 'object' && e.lootable && d2 < bestObjD2) {
        bestObj = e;
        bestObjD2 = d2;
      }
      if (this.isQuestInteractionEntity(e) && d2 < bestQuestD2) {
        bestQuestEntity = e;
        bestQuestD2 = d2;
      }
    });
    // re-read through wider types: TS cannot see the closure assignments above
    const corpse = bestCorpse as Entity | null;
    const obj = bestObj as Entity | null;
    const questEntity = bestQuestEntity as Entity | null;
    if (corpse) {
      this.lootCorpse(corpse.id, p.id);
      return;
    }
    if (obj) {
      if (obj.templateId === 'dungeon_door' && obj.dungeonId) {
        this.enterDungeon(obj.dungeonId, p.id);
        return;
      }
      if (obj.templateId === 'dungeon_exit') {
        this.leaveDungeon(p.id);
        return;
      }
      if (this.tryStartNythraxisWardChannel(obj, p)) return;
      this.pickUpObject(obj.id, p.id);
      return;
    }
    if (questEntity) this.talkToNpc(questEntity.id, p.id);
  }

  private isQuestInteractionEntity(e: Entity): boolean {
    if (e.kind === 'npc') return true;
    return e.kind === 'mob' && !e.hostile && !e.dead && e.questIds.length > 0;
  }

  talkToNpc(npcId: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta } = r;
    const npc = this.entities.get(npcId);
    if (!npc || !this.isQuestInteractionEntity(npc)) return;
    if (this.interactNpcForQuests(npc, meta)) return;
    for (const qid of npc.questIds) {
      const quest = QUESTS[qid];
      if (
        quest &&
        isQuestTurnInNpc(quest, npc.templateId) &&
        meta.questLog.get(qid)?.state === 'ready'
      ) {
        this.turnInQuest(qid, meta.entityId);
        return;
      }
    }
    for (const qid of npc.questIds) {
      if (
        QUESTS[qid].giverNpcId === npc.templateId &&
        this.questState(qid, meta.entityId) === 'available'
      ) {
        this.acceptQuest(qid, meta.entityId);
        return;
      }
    }
  }

  private interactNpcForQuests(npc: Entity, meta: PlayerMeta): boolean {
    let progressed = false;
    for (const qp of meta.questLog.values()) {
      if (qp.state !== 'active') continue;
      const quest = QUESTS[qp.questId];
      quest.objectives.forEach((objective, objectiveIndex) => {
        if (objective.type !== 'interact' || objective.targetNpcId !== npc.templateId) return;
        if (qp.counts[objectiveIndex] >= objective.count) return;
        qp.counts[objectiveIndex]++;
        progressed = true;
        meta.counters.questProgress++;
        this.emit({
          type: 'questProgress',
          questId: qp.questId,
          text: `${objective.label}: ${qp.counts[objectiveIndex]}/${objective.count}`,
          pid: meta.entityId,
        });
        this.ctx.checkQuestReady(qp, meta);
      });
    }
    return progressed;
  }

  // -------------------------------------------------------------------------
  // Quests
  // -------------------------------------------------------------------------

  questState(questId: string, pid?: number): QuestState {
    const r = this.resolve(pid);
    if (!r) return 'unavailable';
    return computeQuestState(questId, r.meta.questLog, r.meta.questsDone, r.e.level);
  }

  private questNpcFor(
    questId: string,
    role: 'giver' | 'turnIn',
    p: Entity,
  ): { npc: Entity | null; tooFar: boolean } {
    const quest = QUESTS[questId];
    const templateIds = role === 'giver' ? [quest.giverNpcId] : questTurnInNpcIds(quest);
    let sawNpc = false;
    for (const e of this.entities.values()) {
      if (!this.isQuestInteractionEntity(e) || !templateIds.includes(e.templateId)) continue;
      if (role === 'giver' && e.kind !== 'npc') continue;
      sawNpc = true;
      if (dist2d(p.pos, e.pos) <= INTERACT_RANGE + 2) return { npc: e, tooFar: false };
    }
    return { npc: null, tooFar: sawNpc };
  }

  // Shared accept core for the NPC and linked-share paths. Records progress, then
  // re-grants any requiredItem the player no longer holds so a lost prerequisite item
  // can never permanently block the quest, and announces the accept. Both callers go
  // through here so the two paths cannot drift (notably this re-grant).
  private finalizeQuestAccept(questId: string, quest: QuestDef, meta: PlayerMeta): void {
    meta.questLog.set(questId, { questId, counts: quest.objectives.map(() => 0), state: 'active' });
    for (const itemId of questFallbackGrants(
      quest,
      (id) => this.countItem(id, meta.entityId) > 0,
    )) {
      this.addItem(itemId, 1, meta.entityId);
    }
    this.emit({ type: 'questAccepted', questId, pid: meta.entityId });
    this.emit({
      type: 'log',
      text: `Quest accepted: ${quest.name}`,
      color: '#ff0',
      pid: meta.entityId,
    });
    this.ctx.onInventoryChangedForQuests(meta);
  }

  acceptQuest(questId: string, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const quest = QUESTS[questId];
    const { meta, e: p } = r;
    if (!quest) {
      this.error(meta.entityId, 'That quest is not available.');
      return;
    }
    if (this.questState(questId, meta.entityId) !== 'available') {
      this.error(meta.entityId, 'That quest is not available.');
      return;
    }
    const nearby = this.questNpcFor(questId, 'giver', p);
    if (!nearby.npc) {
      this.error(
        meta.entityId,
        nearby.tooFar ? 'Too far away.' : 'That quest giver is not nearby.',
      );
      return;
    }
    this.finalizeQuestAccept(questId, quest, meta);
  }

  acceptLinkedQuest(questId: string, sharerPid: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta } = r;
    const quest = QUESTS[questId];
    if (!quest || quest.retired || quest.shareable === false) {
      this.error(meta.entityId, "This quest can't be shared.");
      return;
    }
    const myParty = this.partyOf(meta.entityId);
    const sharerParty = this.partyOf(sharerPid);
    const sharer = this.players.get(sharerPid);
    if (!myParty || !sharerParty || myParty.id !== sharerParty.id) {
      const sharerName = sharer ? sharer.name : 'that player';
      this.error(meta.entityId, `You must be in ${sharerName}'s party to accept that quest.`);
      return;
    }
    if (this.questState(questId, meta.entityId) !== 'available') {
      this.error(meta.entityId, 'That quest is not available.');
      return;
    }
    this.finalizeQuestAccept(questId, quest, meta);
    if (sharer) this.notice(sharerPid, `${meta.name} accepted your shared quest.`);
  }

  abandonQuest(questId: string, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta } = r;
    if (!meta.questLog.has(questId)) return;
    meta.questLog.delete(questId);
    this.emit({
      type: 'log',
      text: `Quest abandoned: ${QUESTS[questId].name}`,
      color: '#f66',
      pid: meta.entityId,
    });
  }

  turnInQuest(questId: string, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    const quest = QUESTS[questId];
    if (!quest) {
      this.error(meta.entityId, 'That quest is not available.');
      return;
    }
    const qp = meta.questLog.get(questId);
    if (!qp) {
      this.error(meta.entityId, 'That quest is not in your log.');
      return;
    }
    if (qp.state !== 'ready') {
      this.error(meta.entityId, 'That quest is not complete.');
      return;
    }
    const nearby = this.questNpcFor(questId, 'turnIn', p);
    if (!nearby.npc) {
      this.error(
        meta.entityId,
        nearby.tooFar ? 'Too far away.' : 'That quest turn-in is not nearby.',
      );
      return;
    }

    for (const obj of quest.objectives) {
      if (obj.type === 'collect' && obj.itemId)
        this.removeItem(obj.itemId, obj.count, meta.entityId);
    }
    qp.state = 'done';
    meta.questLog.delete(questId);
    meta.questsDone.add(questId);
    meta.counters.questsCompleted++;
    if (quest.copperReward > 0) {
      meta.copper += quest.copperReward;
      this.emit({
        type: 'loot',
        text: `You receive ${formatMoney(quest.copperReward)}.`,
        pid: meta.entityId,
      });
    }
    const rewardItem = questRewardItemId(quest, meta.cls);
    if (rewardItem) this.addItem(rewardItem, 1, meta.entityId);
    this.grantXp(quest.xpReward, meta);
    this.emit({ type: 'questDone', questId, pid: meta.entityId });
    this.emit({
      type: 'log',
      text: `Quest completed: ${quest.name}`,
      color: '#ff0',
      pid: meta.entityId,
    });
  }

  // No-op in offline mode
  reportTelemetry(): void {}

  // Quest-credit math (onMobKilledForQuests / onInventoryChangedForQuests /
  // checkQuestReady) moved to quests/quest_credit.ts (Q1) behind SimContext. Foreign
  // callers reach the trio via this.ctx.<name>: the handleDeath party loop calls
  // ctx.onMobKilledForQuests, the inventory hub (addItem/removeItem/buyBackItem) and
  // finalizeQuestAccept call ctx.onInventoryChangedForQuests, and interactNpcForQuests
  // plus the N1 crypt interactObjectForQuests call ctx.checkQuestReady.

  // -------------------------------------------------------------------------
  // Player death / respawn
  // -------------------------------------------------------------------------

  // Player death/respawn lives in entity_roster.ts (E1, merged E2). Thin delegate
  // keeps the public IWorld surface (`sim.releaseSpirit`) resolving unchanged.
  releaseSpirit(pid?: number): void {
    releasePlayerSpirit(this.ctx, pid);
  }

  // Token-bucket throttle: returns false (and notifies the player once) when
  // they are out of chat tokens. Keeps /g and /w from being spam amplifiers.
  private chatAllowed(pid: number): boolean {
    let b = this.chatTokens.get(pid);
    if (!b) {
      b = { tokens: CHAT_BURST, at: this.time };
      this.chatTokens.set(pid, b);
    }
    b.tokens = Math.min(CHAT_BURST, b.tokens + (this.time - b.at) * CHAT_REFILL);
    b.at = this.time;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  // Dev chat cheats — only when Sim.devCommands is enabled (offline local play
  // or online server with ALLOW_DEV_COMMANDS=1). Returns null when handled
  // (no channel message), or undefined when not a dev command.
  private handleDevChat(raw: string, pid: number): SentChat | null | undefined {
    const levelM = /^\/(?:dev\s+level|devlevel)\s+(\d+)\s*$/i.exec(raw);
    if (levelM) {
      const level = Number(levelM[1]);
      this.setPlayerLevel(level, pid);
      this.emit({
        type: 'log',
        text: `[dev] Level set to ${Math.max(1, Math.min(MAX_LEVEL, level))}.`,
        pid,
      });
      return null;
    }
    const tpM = /^\/(?:dev\s+tp|devtp)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/i.exec(raw);
    if (tpM) {
      const e = this.entities.get(pid);
      if (e) {
        const p = this.groundPos(Number(tpM[1]), Number(tpM[2]));
        e.pos = p;
        e.prevPos = { ...p };
        this.grid.update(e);
        this.playerGrid.update(e);
        this.emit({
          type: 'log',
          text: `[dev] Teleported to ${p.x.toFixed(1)}, ${p.z.toFixed(1)}.`,
          pid,
        });
      }
      return null;
    }
    const giveM = /^\/(?:dev\s+give|devgive)\s+(\S+)(?:\s+(\d+))?\s*$/i.exec(raw);
    if (giveM) {
      const itemId = giveM[1];
      const count = Math.max(1, Math.min(20, Number(giveM[2] ?? 1)));
      if (!ITEMS[itemId]) {
        this.error(pid, `[dev] Unknown item '${itemId}'.`);
        return null;
      }
      this.addItem(itemId, count, pid);
      return null;
    }
    if (/^\/dev(?:\s|$)/i.test(raw)) {
      this.error(pid, 'Dev commands: /dev level N, /dev tp X Z, /dev give itemId [count]');
      return null;
    }
    return undefined;
  }

  private whisperMessageForName(rest: string, name: string, exactCase: boolean): string | null {
    const input = exactCase ? rest : rest.toLowerCase();
    const prefix = exactCase ? name : name.toLowerCase();
    if (!input.startsWith(prefix)) return null;
    const next = rest.charAt(name.length);
    if (!next || !/\s/.test(next)) return null;
    const message = rest.slice(name.length).trim();
    return message ? message : null;
  }

  private resolveWhisperTarget(
    rest: string,
  ): { target: PlayerMeta; message: string } | { error: string } | null {
    const trimmed = rest.trim();
    if (!trimmed) return null;
    const matches: { target: PlayerMeta; message: string; exactCase: boolean }[] = [];
    for (const target of this.players.values()) {
      const exactMessage = this.whisperMessageForName(trimmed, target.name, true);
      if (exactMessage !== null) {
        matches.push({ target, message: exactMessage, exactCase: true });
        continue;
      }
      const insensitiveMessage = this.whisperMessageForName(trimmed, target.name, false);
      if (insensitiveMessage !== null)
        matches.push({ target, message: insensitiveMessage, exactCase: false });
    }
    matches.sort((a, b) => b.target.name.length - a.target.name.length);
    const longestLength = matches[0]?.target.name.length ?? 0;
    const longest = matches.filter((m) => m.target.name.length === longestLength);
    const exact = longest.filter((m) => m.exactCase);
    if (exact.length > 0) return exact[0];
    if (longest.length === 1) return longest[0];
    const typedName = trimmed.split(/\s+/, 1)[0] ?? trimmed;
    if (longest.length > 1)
      return { error: `Several players match '${typedName}'. Use exact capitalization.` };
    return { error: `There is no player named '${typedName}' online.` };
  }

  chat(text: string, pid?: number): SentChat | null {
    const r = this.resolve(pid);
    if (!r) return null;
    const raw = text.trim().slice(0, MAX_CHAT_MESSAGE_LEN);
    if (!raw) return null;
    if (!this.chatAllowed(r.meta.entityId)) {
      this.error(r.meta.entityId, 'You are sending messages too quickly.');
      return null;
    }

    // "/afk [message]" / "/dnd [message]" — set a presence status. Repeating
    // the same command with no message toggles it off. While away, anyone who
    // whispers you gets an auto-reply; /dnd also withholds the whisper itself.
    const awaym = /^\/(afk|dnd)(?:\s+([\s\S]+))?$/i.exec(raw);
    if (awaym) {
      const mode = awaym[1].toLowerCase() as AwayStatus['mode'];
      const custom = awaym[2]?.trim();
      if (r.meta.away?.mode === mode && !custom) {
        r.meta.away = null;
        this.emit({
          type: 'log',
          text:
            mode === 'afk'
              ? 'You are no longer Away From Keyboard.'
              : 'You have left Do Not Disturb mode.',
          color: '#ffd100',
          pid: r.meta.entityId,
        });
      } else {
        const message = custom || (mode === 'afk' ? 'Away From Keyboard' : 'Do Not Disturb');
        r.meta.away = { mode, message };
        this.emit({
          type: 'log',
          text:
            mode === 'afk'
              ? `You are now Away From Keyboard: ${message}`
              : `You are now in Do Not Disturb mode: ${message}`,
          color: '#ffd100',
          pid: r.meta.entityId,
        });
      }
      return null;
    }

    // Any other chat means you're back — clear a lingering away status.
    if (r.meta.away) {
      r.meta.away = null;
      this.emit({
        type: 'log',
        text: 'You are no longer marked as away.',
        color: '#ffd100',
        pid: r.meta.entityId,
      });
    }

    // "/party" (no message) is a self-only roster readout; "/party <msg>"
    // and "/p <msg>" stay party chat (the trailing \s in that branch below).
    if (/^\/(party|group|grp)\s*$/i.test(raw)) {
      this.error(r.meta.entityId, this.partyReadout(r.meta.entityId));
      return null;
    }

    if (this.devCommands) {
      const devHandled = this.handleDevChat(raw, r.meta.entityId);
      if (devHandled !== undefined && devHandled !== null) return devHandled;
    }

    if (/^\/who(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, 'The /who roster is available in online play.');
      return null;
    }

    // "/talents" (aliases "/talent", "/spec") — self-only readout of the
    // player's specialization and how their talent points are spent. Returns
    // null (unlogged); no server interceptor, so it works online for free.
    if (/^\/(?:talents|talent|spec)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.talentsReadout(r.meta, r.e));
      return null;
    }

    // "/help" (or "/?" / "/commands") lists the available chat commands as a
    // system notice to the asker only. Like /who, it produces no chat message,
    // so it works identically offline and online without server wiring.
    if (/^\/(?:help|commands|\?)(?:\s|$)/i.test(raw)) {
      for (const line of this.helpLines()) this.error(r.meta.entityId, line);
      return null;
    }

    // "/roll", "/roll N", "/roll M-N" — a classic random roll for loot disputes
    // and social play. Rolled through the deterministic sim RNG so it is
    // server-authoritative (clients can't fake a result) and identical offline.
    const rollm = /^\/roll(?:\s+(\d+)(?:\s*-\s*(\d+))?)?\s*$/i.exec(raw);
    if (rollm) {
      let lo = 1,
        hi = 100;
      if (rollm[1] !== undefined) {
        const n = parseInt(rollm[1], 10);
        if (rollm[2] !== undefined) {
          lo = n;
          hi = parseInt(rollm[2], 10);
        } else {
          hi = n;
        }
      }
      const MAX_ROLL = 1_000_000;
      if (lo < 1 || hi > MAX_ROLL || lo > hi) {
        this.error(
          r.meta.entityId,
          `Invalid roll range. Use /roll, /roll N, or /roll M-N (1-${MAX_ROLL}).`,
        );
        return null;
      }
      const result = this.rng.int(lo, hi);
      const text = `${result} (${lo}-${hi})`;
      const party = this.partyOf(r.meta.entityId);
      if (party) {
        for (const mPid of party.members) {
          this.emit({
            type: 'chat',
            fromPid: r.meta.entityId,
            from: r.meta.name,
            text,
            channel: 'roll',
            pid: mPid,
          });
        }
      } else {
        for (const meta of this.players.values()) {
          const e = this.entities.get(meta.entityId);
          if (!e || dist2d(r.e.pos, e.pos) > SAY_RANGE) continue;
          this.emit({
            type: 'chat',
            fromPid: r.meta.entityId,
            from: r.meta.name,
            text,
            channel: 'roll',
            pid: meta.entityId,
          });
        }
      }
      return null;
    }

    // "/r message" — reply to the last player who whispered us. Rewrite it to
    // the "/w <name> message" form so delivery, the echo, and case-matching
    // all stay in the single whisper handler below.
    const rm = /^\/r(?:eply)?\s+([\s\S]+)$/i.exec(raw);
    let line = raw;
    if (rm) {
      const replyTo = r.meta.lastWhisperFrom;
      if (!replyTo) {
        this.error(r.meta.entityId, 'You have no one to reply to.');
        return null;
      }
      line = `/w ${replyTo} ${rm[1]}`;
    }

    // "/inspect name" — self-only readout of another online player's level,
    // class, and health. The first cross-player readout; mirrors WoW's Inspect.
    const im = /^\/(?:inspect|ins|examine)(?:\s+([\s\S]+))?$/i.exec(raw);
    if (im) {
      const targetName = (im[1] ?? '').trim();
      if (!targetName) {
        this.error(r.meta.entityId, 'Inspect whom? Usage: /inspect <name>.');
        return null;
      }
      // resolve by name with the same exact-then-unambiguous-CI rule as /w
      let target: PlayerMeta | null = null;
      const ciMatches: PlayerMeta[] = [];
      const wanted = targetName.toLowerCase();
      for (const meta of this.players.values()) {
        if (meta.name === targetName) {
          target = meta;
          break;
        }
        if (meta.name.toLowerCase() === wanted) ciMatches.push(meta);
      }
      if (!target) {
        if (ciMatches.length === 1) target = ciMatches[0];
        else if (ciMatches.length > 1) {
          this.error(
            r.meta.entityId,
            `Several players match '${targetName}'. Use exact capitalization.`,
          );
          return null;
        }
      }
      const te = target ? this.entities.get(target.entityId) : null;
      if (!target || !te) {
        this.error(r.meta.entityId, `There is no player named '${targetName}' online.`);
        return null;
      }
      this.error(r.meta.entityId, this.inspectReadout(target, te));
      return null;
    }

    // "/unfollow" stops an active follow
    if (/^\/unfollow(?:\s|$)/i.test(raw)) {
      if (r.e.followTargetId === null) this.error(r.meta.entityId, 'You are not following anyone.');
      else this.stopFollow(r.e, 'You stop following.');
      return null;
    }

    // "/follow [name]" trails another player; with no name it follows the
    // current target. Movement, combat, casting, re-targeting, or the leader
    // moving out of range all end it (see updateFollowMovement).
    const fm = /^\/follow(?:\s+([\s\S]+))?$/i.exec(raw);
    if (fm) {
      if (r.e.inCombat) {
        this.error(r.meta.entityId, "You can't start following while in combat.");
        return null;
      }
      let target: PlayerMeta | null = null;
      const nameArg = (fm[1] ?? '').trim();
      if (nameArg) {
        const wanted = nameArg.toLowerCase();
        const ci: PlayerMeta[] = [];
        for (const meta of this.players.values()) {
          if (meta.name === nameArg) {
            target = meta;
            break;
          }
          if (meta.name.toLowerCase() === wanted) ci.push(meta);
        }
        if (!target) {
          if (ci.length === 1) target = ci[0];
          else if (ci.length > 1) {
            this.error(
              r.meta.entityId,
              `Several players match '${nameArg}'. Use exact capitalization.`,
            );
            return null;
          }
        }
        if (!target) {
          this.error(r.meta.entityId, `There is no player named '${nameArg}' online.`);
          return null;
        }
      } else {
        const cur = r.e.targetId !== null ? this.players.get(r.e.targetId) : undefined;
        if (!cur) {
          this.error(r.meta.entityId, 'Target a player to follow, or use /follow <name>.');
          return null;
        }
        target = cur;
      }
      if (target.entityId === r.meta.entityId) {
        this.error(r.meta.entityId, "You can't follow yourself.");
        return null;
      }
      r.e.followTargetId = target.entityId;
      this.error(r.meta.entityId, `Now following ${target.name}.`);
      return null;
    }

    // "/assist [name]" targets whatever the named player is targeting (group-play /
    // multiboxing target-matching). With no name it assists the player you currently
    // have targeted. Resolution lives in the pure resolveAssist() core.
    const am = /^\/(?:assist|as)(?:\s+([\s\S]+))?$/i.exec(raw);
    if (am) {
      // Scope the candidate roster the way the server scopes a snapshot: players within
      // interest range of the caster, PLUS the caster's party/raid members by name no
      // matter how far they have roamed. Classic /assist only resolves a unit you could
      // know about, never an arbitrary stranger across the map.
      const assistParty = this.partyOf(r.meta.entityId);
      const candidates: AssistCandidate[] = [];
      for (const meta of this.players.values()) {
        const ent = this.entities.get(meta.entityId);
        const inParty = assistParty ? assistParty.members.includes(meta.entityId) : false;
        const inRange = ent ? dist2d(r.e.pos, ent.pos) <= ASSIST_RANGE : false;
        if (meta.entityId !== r.meta.entityId && !inParty && !inRange) continue;
        candidates.push({
          entityId: meta.entityId,
          name: meta.name,
          targetId: ent ? ent.targetId : null,
        });
      }
      const res = resolveAssist(candidates, r.meta.entityId, am[1] ?? '');
      if (res.kind === 'error') {
        this.error(r.meta.entityId, res.message);
        return null;
      }
      this.targetEntity(res.targetId, pid);
      this.error(r.meta.entityId, `Assisting ${res.leaderName}.`);
      return null;
    }

    // "/played" — report how long this character has been in the world this
    // session. Self-only informational line, like /who's reply.
    if (/^\/played(?:\s|$)/i.test(raw)) {
      const secs = Math.max(0, Math.floor(this.time - r.meta.joinedAt));
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      const parts: string[] = [];
      if (h) parts.push(`${h}h`);
      if (h || m) parts.push(`${m}m`);
      parts.push(`${s}s`);
      this.error(r.meta.entityId, `Time played this session: ${parts.join(' ')}.`);
      return null;
    }

    // Self-only readouts: emit a private system line and never become chat.
    if (/^\/(?:where|loc|zone)(?:\s|$)/i.test(raw)) {
      const zone = zoneAt(r.e.pos.z);
      const [lo, hi] = zone.levelRange;
      this.error(
        r.meta.entityId,
        `You are in ${zone.name} (levels ${lo}–${hi}) at (${Math.floor(r.e.pos.x)}, ${Math.floor(r.e.pos.z)}).`,
      );
      return null;
    }
    if (/^\/(?:target|tar)(?:\s|$)/i.test(raw)) {
      const tid = r.e.targetId;
      const t = tid !== null ? (this.entities.get(tid) ?? null) : null;
      if (!t) this.error(r.meta.entityId, 'You have no target.');
      else this.error(r.meta.entityId, this.targetReadout(t));
      return null;
    }
    if (/^\/(?:xp|exp|experience)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.xpReadout(r.meta, r.e.level));
      return null;
    }
    if (/^\/(?:gold|money|coins)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.goldReadout(r.meta.copper));
      return null;
    }
    if (/^\/(?:stats|st|sheet)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.statsReadout(r.meta, r.e));
      return null;
    }
    if (/^\/(?:buffs?|auras)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.buffsReadout(r.e));
      return null;
    }
    if (/^\/(?:cooldowns?|cds?)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.cooldownsReadout(r.e));
      return null;
    }
    if (/^\/(?:bags|inv|inventory)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.bagsReadout(r.meta));
      return null;
    }
    if (/^\/(?:quests?|ql)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.questReadout(r.meta));
      return null;
    }
    if (/^\/(?:gear|equip|equipment)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.gearReadout(r.meta));
      return null;
    }
    if (/^\/(?:abilities|spells|spellbook)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.abilitiesReadout(r.meta, r.e));
      return null;
    }
    if (/^\/(?:pet|pets|companion)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.petReadout(r.e));
      return null;
    }
    if (/^\/(?:session|sess|sessionstats)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.sessionReadout(r.meta));
      return null;
    }
    if (/^\/(?:threat|aggro)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.threatReadout(r.e));
      return null;
    }
    if (/^\/(?:zones|zonelist|worldmap)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.zonesReadout(r.e.pos.z));
      return null;
    }
    if (/^\/(?:nearby|near|around)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.nearbyReadout(r.e));
      return null;
    }
    if (/^\/(?:arena|pvp|rating)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.arenaReadout(r.meta));
      return null;
    }
    if (/^\/(?:range|dist|distance)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.rangeReadout(r.e));
      return null;
    }
    if (/^\/(?:buyback|bb|repurchase)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.buybackReadout(r.meta));
      return null;
    }
    if (/^\/(?:combo|cp|combopoints)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.comboReadout(r.e));
      return null;
    }
    if (/^\/(?:combat|cb|incombat)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.combatReadout(r.e));
      return null;
    }
    if (/^\/(?:graveyard|gy|spirithealer)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, graveyardReadout(r.e));
      return null;
    }
    if (/^\/(?:dungeons|dungeon|instances)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.dungeonsReadout());
      return null;
    }
    if (/^\/(?:consider|con|difficulty)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.considerReadout(r.e));
      return null;
    }
    if (/^\/(?:pois|poi|landmarks)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.poisReadout(r.e));
      return null;
    }
    if (/^\/(?:completed|questsdone|qdone)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.completedReadout(r.meta));
      return null;
    }
    if (/^\/(?:listings|mylistings|auctions)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.listingsReadout(r.meta));
      return null;
    }
    if (/^\/(?:targetbuffs|debuffs|tb)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.targetBuffsReadout(r.e));
      return null;
    }
    if (/^\/(?:casting|cast|castbar)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.castingReadout(r.e));
      return null;
    }
    if (/^\/(?:speed|movespeed|ms)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.speedReadout(r.e));
      return null;
    }
    if (/^\/(?:attack|autoattack|aa)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.attackReadout(r.e, r.meta));
      return null;
    }
    if (/^\/(consumable|consumables|eat|drink)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.consumableReadout(r.e));
      return null;
    }
    if (/^\/(?:potion|potioncd|pot)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.potionReadout(r.e));
      return null;
    }
    if (/^\/(?:overpower|op|overpowered)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.overpowerReadout(r.e, r.meta));
      return null;
    }
    if (/^\/(form|stance|shapeshift)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.formReadout(r.e));
      return null;
    }
    if (/^\/(?:manaregen|regen|5sr)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.manaRegenReadout(r.e));
      return null;
    }
    if (/^\/(?:falling|jump|airborne)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.fallingReadout(r.e));
      return null;
    }
    if (/^\/(?:pettaunt|petgrowl|growl)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.petTauntReadout(r.e));
      return null;
    }
    if (/^\/(queued|onswing|swingqueue)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.queuedReadout(r.e));
      return null;
    }
    if (/^\/(?:savedmana|parkedmana|sm)(?:\s|$)/i.test(raw)) {
      this.error(r.meta.entityId, this.savedManaReadout(r.meta, r.e));
      return null;
    }

    // "/w name message" — private whisper to an online player. Match against
    // `line` so a "/r" reply (rewritten to the /w form above) flows through the
    // same longest-online-name resolver.
    const wm = /^\/(?:w|whisper|t|tell)\s+([\s\S]+)$/i.exec(line);
    if (wm) {
      const resolved = this.resolveWhisperTarget(wm[1]);
      if (!resolved) return null;
      if ('error' in resolved) {
        this.error(r.meta.entityId, resolved.error);
        return null;
      }
      const { target, message: msg } = resolved;
      if (target.entityId === r.meta.entityId) {
        this.error(r.meta.entityId, 'You mutter to yourself. Nobody hears it.');
        return null;
      }
      if (target.away) {
        const label = target.away.mode === 'afk' ? 'Away From Keyboard' : 'Do Not Disturb';
        this.emit({
          type: 'log',
          text: `${target.name} is ${label}: ${target.away.message}`,
          color: '#ffd100',
          pid: r.meta.entityId,
        });
        if (target.away.mode === 'dnd') {
          // Withhold the whisper, but still echo the sender's own line so they
          // see what they tried to send.
          this.emit({
            type: 'chat',
            fromPid: r.meta.entityId,
            from: r.meta.name,
            to: target.name,
            text: msg,
            channel: 'whisper',
            pid: r.meta.entityId,
          });
          return { channel: 'whisper', message: msg };
        }
      }
      // classic-WoW "/r": the recipient's reply target is whoever last
      // whispered them, so record it on the target (not the sender).
      target.lastWhisperFrom = r.meta.name;
      this.emit({
        type: 'chat',
        fromPid: r.meta.entityId,
        from: r.meta.name,
        text: msg,
        channel: 'whisper',
        pid: target.entityId,
      });
      this.emit({
        type: 'chat',
        fromPid: r.meta.entityId,
        from: r.meta.name,
        to: target.name,
        text: msg,
        channel: 'whisper',
        pid: r.meta.entityId,
      });
      return { channel: 'whisper', message: msg, target: target.name };
    }

    // "/p message" goes to the party channel
    if (/^\/p(arty)?\s/i.test(raw)) {
      const clean = raw.replace(/^\/p(arty)?\s+/i, '').trim();
      if (!clean) return null;
      const party = this.partyOf(r.meta.entityId);
      if (!party) {
        this.error(r.meta.entityId, 'You are not in a party.');
        return null;
      }
      for (const mPid of party.members) {
        this.emit({
          type: 'chat',
          fromPid: r.meta.entityId,
          from: r.meta.name,
          text: clean,
          channel: 'party',
          pid: mPid,
        });
      }
      return { channel: 'party', message: clean };
    }

    // "/g message" — world-wide general channel (no pid = broadcast to all)
    if (/^\/g(eneral)?\s/i.test(raw)) {
      const clean = raw.replace(/^\/g(eneral)?\s+/i, '').trim();
      if (!clean) return null;
      this.emit({
        type: 'chat',
        fromPid: r.meta.entityId,
        from: r.meta.name,
        text: clean,
        channel: 'general',
      });
      return { channel: 'general', message: clean };
    }

    // "/join <channel>" / "/leave <channel>" — opt-in global channels
    const jm = /^\/(join|leave)\b\s*(\S*)\s*$/i.exec(raw);
    if (jm) {
      this.handleChannelMembership(
        r.meta,
        jm[1].toLowerCase() as 'join' | 'leave',
        jm[2].toLowerCase(),
      );
      return null;
    }

    // "/world message" / "/lfg message" — talk in an opt-in channel; only
    // players who have /join-ed it hear the message (the sender included)
    const cm = /^\/(world|lfg)\s+([\s\S]+)$/i.exec(raw);
    if (cm) {
      const channel = cm[1].toLowerCase() as JoinableChannel;
      const clean = cm[2].trim();
      if (!clean) return null;
      const mine = this.channelSubs.get(r.meta.entityId);
      if (!mine?.has(channel)) {
        this.error(
          r.meta.entityId,
          `You are not in the ${channel} channel. Type /join ${channel} first.`,
        );
        return null;
      }
      for (const [subPid, set] of this.channelSubs) {
        if (set.has(channel) && this.players.has(subPid)) {
          this.emit({
            type: 'chat',
            fromPid: r.meta.entityId,
            from: r.meta.name,
            text: clean,
            channel,
            pid: subPid,
          });
        }
      }
      return { channel, message: clean };
    }

    // "/me <action>" — freeform third-person action text, e.g.
    // "/me ponders the void" → "Aleph ponders the void". Emotes never become
    // the player's sticky chat channel, so this returns null on success.
    const meMatch = /^\/(?:me|emote|e)\s+([\s\S]+)$/i.exec(raw);
    if (meMatch) {
      const action = meMatch[1].trim();
      if (action) this.broadcastEmote(r.meta, r.e, action);
      return null;
    }

    // "/wave", "/dance [name]" — predefined social emotes. An optional name
    // targets an online player (in range or not); unknown names fall back to
    // the untargeted form, matching the classic-MMO convention.
    const emMatch = /^\/([a-z]+)(?:\s+(\S+))?\s*$/i.exec(raw);
    if (emMatch) {
      const key = EMOTE_ALIASES[emMatch[1].toLowerCase()] ?? emMatch[1].toLowerCase();
      const def = EMOTES[key];
      if (def) {
        const targetName = emMatch[2];
        let text = def.solo;
        if (targetName && def.target) {
          const t = this.findPlayerByName(targetName);
          if (t) text = def.target.replace('%t', t.name === r.meta.name ? 'themselves' : t.name);
        }
        this.broadcastEmote(r.meta, r.e, text);
        return null;
      }
    }

    // bare text and "/s" are local say; "/y" carries further — both are
    // delivered per-player by range and carry the speaker for chat bubbles
    let channel: 'say' | 'yell' = 'say';
    let clean = raw;
    if (/^\/y(ell)?\s/i.test(raw)) {
      channel = 'yell';
      clean = raw.replace(/^\/y(ell)?\s+/i, '').trim();
    } else if (/^\/s(ay)?\s/i.test(raw)) {
      clean = raw.replace(/^\/s(ay)?\s+/i, '').trim();
    } else if (raw.startsWith('/')) {
      this.error(r.meta.entityId, `Unknown command: ${raw.split(' ')[0]}. Type /help for a list.`);
      return null;
    }
    if (!clean) return null;
    const range = channel === 'yell' ? YELL_RANGE : SAY_RANGE;
    for (const meta of this.players.values()) {
      const e = this.entities.get(meta.entityId);
      if (!e || dist2d(r.e.pos, e.pos) > range) continue;
      this.emit({
        type: 'chat',
        fromPid: r.meta.entityId,
        from: r.meta.name,
        text: clean,
        channel,
        entityId: r.e.id,
        pid: meta.entityId,
      });
    }
    return { channel, message: clean };
  }

  playEmote(emoteId: OverheadEmoteId, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    r.e.overheadEmoteId = emoteId;
    r.e.overheadEmoteUntil = this.time + OVERHEAD_EMOTE_DURATION;
    r.e.overheadEmoteSeq += 1;
  }

  // Resolve a player by name the same way whispers do: an exact-case match
  // wins outright, otherwise a case-insensitive match is used only when it is
  // unambiguous.
  private findPlayerByName(name: string): PlayerMeta | null {
    const wanted = name.toLowerCase();
    const ci: PlayerMeta[] = [];
    for (const meta of this.players.values()) {
      if (meta.name === name) return meta;
      if (meta.name.toLowerCase() === wanted) ci.push(meta);
    }
    return ci.length === 1 ? ci[0] : null;
  }

  // Send a third-person emote to every player within /say range (including the
  // actor). `from` carries the actor's name so the client can render it as a
  // clickable name; `text` is the action predicate (e.g. "waves at Bet.").
  private broadcastEmote(actor: PlayerMeta, actorEntity: Entity, text: string): void {
    const body = text.slice(0, MAX_CHAT_MESSAGE_LEN);
    for (const meta of this.players.values()) {
      const e = this.entities.get(meta.entityId);
      if (!e || dist2d(actorEntity.pos, e.pos) > SAY_RANGE) continue;
      this.emit({
        type: 'chat',
        fromPid: actor.entityId,
        from: actor.name,
        text: body,
        channel: 'emote',
        entityId: actorEntity.id,
        pid: meta.entityId,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Hostility: mobs are hostile to players; controlled pets inherit their
  // owner's PvP hostility during active duels and arena matches.
  // -------------------------------------------------------------------------

  private pvpController(e: Entity | null): Entity | null {
    if (!e) return null;
    if (e.kind === 'player') return e;
    if (e.kind === 'mob' && e.ownerId !== null) {
      const owner = this.entities.get(e.ownerId);
      return owner?.kind === 'player' ? owner : null;
    }
    return null;
  }

  isHostileTo(attacker: Entity, target: Entity): boolean {
    if (target.kind === 'mob') {
      if (target.templateId.startsWith('vision_')) return false;
      if (target.ownerId !== null) {
        const owner = this.entities.get(target.ownerId);
        return !!owner && owner.kind === 'player' && this.isHostileTo(attacker, owner);
      }
      return target.hostile;
    }
    if (target.kind === 'player') {
      const attackerPlayer = this.pvpController(attacker);
      if (!attackerPlayer) return false;
      if (attackerPlayer.dead) return false;
      if (attackerPlayer.id === target.id) return false;
      const duel = this.duels.get(attackerPlayer.id);
      if (
        duel &&
        duel.state === 'active' &&
        ((duel.a === attackerPlayer.id && duel.b === target.id) ||
          (duel.b === attackerPlayer.id && duel.a === target.id))
      )
        return true;
      const match = this.arenaMatches.get(attackerPlayer.id);
      return (
        !!match &&
        match.state === 'active' &&
        !match.defeated.has(attackerPlayer.id) &&
        this.isArenaCrossTeam(match, attackerPlayer.id, target.id)
      );
    }
    return false;
  }

  private isFriendlyTo(caster: Entity, target: Entity): boolean {
    if (target.kind === 'player') return !this.isHostileTo(caster, target);
    if (target.kind === 'mob' && target.ownerId !== null) {
      const owner = this.entities.get(target.ownerId);
      return !!owner && owner.kind === 'player' && !this.isHostileTo(caster, owner);
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Parties
  // -------------------------------------------------------------------------

  // A1: the party/raid state machine lives in src/sim/social/party.ts. partyOf + the
  // eight command methods stay as thin delegates so IWorld + the many foreign
  // `this.partyOf` call sites (loot/xp/tap/quest/arena/dungeon/UI) resolve unchanged;
  // hasPendingSocialInvite + partyCapacity stay reachable for the trade/duel invite
  // and party-readout paths still on Sim.
  partyOf(pid: number): Party | null {
    return this.party.partyOf(pid);
  }

  private hasPendingSocialInvite(targetPid: number): boolean {
    return this.party.hasPendingSocialInvite(targetPid);
  }

  private entityInDungeon(e: Entity, dungeonId: string): boolean {
    return dungeonAt(e.pos.x)?.id === dungeonId;
  }

  private partyCapacity(party: Party | null): number {
    return this.party.partyCapacity(party);
  }

  partyInvite(targetPid: number, pid?: number): void {
    this.party.partyInvite(targetPid, pid);
  }

  partyAccept(pid?: number): void {
    this.party.partyAccept(pid);
  }

  partyDecline(pid?: number): void {
    this.party.partyDecline(pid);
  }

  partyLeave(pid?: number): void {
    this.party.partyLeave(pid);
  }

  partyKick(targetPid: number, pid?: number): void {
    this.party.partyKick(targetPid, pid);
  }

  convertPartyToRaid(pid?: number): void {
    this.party.convertPartyToRaid(pid);
  }

  convertRaidToParty(pid?: number): void {
    this.party.convertRaidToParty(pid);
  }

  moveRaidMember(targetPid: number, group: 1 | 2, pid?: number): void {
    this.party.moveRaidMember(targetPid, group, pid);
  }
  // nextRaidGroupFor / normalizeRaidGroups / removeFromParty moved to the
  // PartyMachine (src/sim/social/party.ts, A1). removeFromParty is reachable by
  // removePlayer through `this.ctx.removeFromParty` (the SimContext seam).

  // -------------------------------------------------------------------------
  // Raid markers (party-scoped target markers)
  // -------------------------------------------------------------------------

  // Every mark visible to the actor's party, as { entityId: markerId }. Empty
  // when the actor is not in a party. Pure read — cleanup happens on the
  // death/despawn/disband hooks, never here.
  markersFor(pid: number): Record<number, number> {
    const party = this.partyOf(pid);
    if (!party) return {};
    const marks = this.partyMarkers.get(party.id);
    if (!marks) return {};
    const out: Record<number, number> = {};
    for (const [eid, mid] of marks) out[eid] = mid;
    return out;
  }

  setMarker(entityId: number, markerId: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const party = this.partyOf(r.meta.entityId);
    if (!party) {
      this.error(r.meta.entityId, 'You must be in a party to use raid markers.');
      return;
    }
    if (!Number.isInteger(markerId) || markerId < 0 || markerId > 7) return;
    // markable: a live, wild, hostile mob (not players, NPCs, corpses, or pets)
    const target = this.entities.get(entityId);
    if (target?.kind !== 'mob' || target.dead || !target.hostile || target.ownerId !== null) return;
    let marks = this.partyMarkers.get(party.id);
    if (!marks) {
      marks = new Map();
      this.partyMarkers.set(party.id, marks);
    }
    // re-applying the same symbol to the same mob toggles it off
    if (marks.get(entityId) === markerId) {
      marks.delete(entityId);
      return;
    }
    // a symbol is unique within the party: take it off whatever held it
    for (const [eid, mid] of marks) {
      if (mid === markerId) marks.delete(eid);
    }
    marks.set(entityId, markerId);
  }

  clearMarker(entityId: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const party = this.partyOf(r.meta.entityId);
    if (!party) return;
    this.partyMarkers.get(party.id)?.delete(entityId);
  }

  // The local player's view of one entity's mark (for the renderer). Direct
  // lookup, no per-call allocation.
  markerFor(entityId: number): number | null {
    const party = this.partyOf(this.primaryId);
    if (!party) return null;
    return this.partyMarkers.get(party.id)?.get(entityId) ?? null;
  }

  // Strip an entity's mark from every party — used when it dies or despawns.
  private clearEntityMarker(entityId: number): void {
    for (const marks of this.partyMarkers.values()) marks.delete(entityId);
  }

  // -------------------------------------------------------------------------
  // Duels
  // -------------------------------------------------------------------------

  duelRequest(targetPid: number, pid?: number): void {
    duelMod.duelRequest(this.ctx, targetPid, pid);
  }

  duelAccept(pid?: number): void {
    duelMod.duelAccept(this.ctx, pid);
  }

  duelDecline(pid?: number): void {
    duelMod.duelDecline(this.ctx, pid);
  }

  // Persistent social systems (friends / ignore / guilds) require an account
  // and database, so they only exist in online play. The offline Sim satisfies
  // the IWorld surface with inert stubs.
  realm = '';
  socialInfo: null = null;
  friendAdd(_name: string): void {}
  friendRemove(_name: string): void {}
  blockAdd(_name: string): void {}
  blockRemove(_name: string): void {}
  guildCreate(_name: string): void {}
  guildInvite(_name: string): void {}
  guildAccept(): void {}
  guildDecline(): void {}
  guildLeave(): void {}
  guildKick(_name: string): void {}
  guildPromote(_name: string): void {}
  guildDemote(_name: string): void {}
  guildTransfer(_name: string): void {}
  guildDisband(): void {}
  searchCharacters(_query: string): Promise<import('../world_api').CharacterSearchResult[]> {
    return Promise.resolve([]);
  }

  private updateDuels(): void {
    duelMod.updateDuels(this.ctx);
  }

  private clearAurasFromSource(target: Entity, sourceId: number): void {
    let statsDirty = false;
    for (let i = target.auras.length - 1; i >= 0; i--) {
      const a = target.auras[i];
      if (a.sourceId !== sourceId) continue;
      target.auras.splice(i, 1);
      this.emit({ type: 'aura', targetId: target.id, name: a.name, gained: false });
      if (a.kind.startsWith('buff') || a.kind.startsWith('form')) statsDirty = true;
    }
    if (statsDirty && target.kind === 'player') {
      const meta = this.players.get(target.id);
      if (meta) recalcPlayerStats(target, meta.cls, meta.equipment, this.playerMods(meta));
    }
  }

  // winnerPid null = draw/cancelled
  private endDuel(duel: DuelState, winnerPid: number | null): void {
    duelMod.endDuel(this.ctx, duel, winnerPid);
  }

  duelFor(pid: number): DuelState | null {
    return duelMod.duelFor(this.ctx, pid);
  }

  // -------------------------------------------------------------------------
  // The Ashen Coliseum — ranked arena (1v1 + 2v2 queue, matchmaking, Elo)
  // -------------------------------------------------------------------------

  arenaQueueJoin(pidOrFormat?: number | ArenaFormat, format: ArenaFormat = '1v1'): void {
    arenaMod.arenaQueueJoin(this.ctx, pidOrFormat, format);
  }

  arenaQueueLeave(pid?: number): void {
    arenaMod.arenaQueueLeave(this.ctx, pid);
  }

  private isArenaQueued(pid: number): boolean {
    return arenaMod.isArenaQueued(this.ctx, pid);
  }

  private arenaQueuedFormat(pid: number): ArenaFormat | null {
    return arenaMod.arenaQueuedFormat(this.ctx, pid);
  }

  private arenaDequeue(pid: number): boolean {
    return arenaMod.arenaDequeue(this.ctx, pid);
  }

  private arenaTeamOf(match: ArenaMatch, pid: number): 'A' | 'B' | null {
    return arenaMod.arenaTeamOf(this.ctx, match, pid);
  }

  arenaAllPids(match: ArenaMatch): number[] {
    return arenaMod.arenaAllPids(match);
  }

  private arenaStanding(meta: PlayerMeta, format: ArenaFormat): ArenaStanding {
    return arenaMod.arenaStanding(meta, format);
  }

  private isArenaCrossTeam(match: ArenaMatch, attackerPid: number, targetPid: number): boolean {
    return arenaMod.isArenaCrossTeam(this.ctx, match, attackerPid, targetPid);
  }

  private arenaIsDown(match: ArenaMatch, pid: number): boolean {
    return arenaMod.arenaIsDown(match, pid);
  }

  private isArenaTeamWiped(match: ArenaMatch, team: 'A' | 'B'): boolean {
    return arenaMod.isArenaTeamWiped(match, team);
  }

  private arenaCombatants(pids: number[]): ArenaCombatant[] {
    return arenaMod.arenaCombatants(this.ctx, pids);
  }

  private updateArena(): void {
    arenaMod.updateArena(this.ctx);
  }

  // A3: createFiestaState (FiestaState factory + per-match sub-Rng seed) moved to
  // social/fiesta.ts. Thin delegate keeps the ctx.createFiestaState seam binding
  // (consumed by the moved arena startArenaMatch) resolving into the module.
  private createFiestaState(): FiestaState {
    return fiestaMod.createFiestaState(this.ctx);
  }

  private placeInArena(
    e: Entity,
    origin: { x: number; z: number },
    spawn: { x: number; z: number; facing: number },
  ): void {
    arenaMod.placeInArena(this.ctx, e, origin, spawn);
  }

  private resetForArena(e: Entity): void {
    arenaMod.resetForArena(this.ctx, e);
  }

  private readyArenaFighter(e: Entity, opts: { clearPrep: boolean }): void {
    arenaMod.readyArenaFighter(this.ctx, e, opts);
  }

  private endArenaMatch(
    match: ArenaMatch,
    winnerTeam: 'A' | 'B' | null,
    reason: 'defeat' | 'timeout' | 'forfeit',
  ): void {
    arenaMod.endArenaMatch(this.ctx, match, winnerTeam, reason);
  }

  private returnFromArena(match: ArenaMatch): void {
    arenaMod.returnFromArena(this.ctx, match);
  }

  arenaMatchFor(pid: number): ArenaMatch | null {
    return arenaMod.arenaMatchFor(this.ctx, pid);
  }

  // -------------------------------------------------------------------------
  // 2v2 Fiesta — the dopamine-maxxed party mode. Score-based respawning bouts
  // with augment waves and a closing hazard ring. The match lifecycle reuses the
  // arena's countdown/aftermath; everything below drives the active phase.
  // -------------------------------------------------------------------------

  // The effective talent modifiers for a player: their talents with any Fiesta
  // augments folded in. Every stat/ability/threat recompute reads through this,
  // so augments persist through aura procs, gear swaps, and respawns.
  playerMods(meta: PlayerMeta): TalentModifiers {
    return meta.fiestaMods ?? meta.talentMods;
  }

  // -------------------------------------------------------------------------
  // 2v2 Fiesta: match logic MOVED to social/fiesta.ts (A3). Sim keeps thin
  // same-named delegates for the foreign-reachable surface: the seam-bound hooks
  // (createFiestaState above; fiestaStandardize / updateFiestaActive /
  // fiestaRestoreChar / clearFiestaAugments consumed by the moved arena lifecycle;
  // fiestaTakedown / fiestaDown consumed by dealDamage's cross-team arms), the
  // public arenaAugmentPick command (HUD + offline bots), and fiestaOpenWave /
  // fiestaRespawnTime (parity scenario + fiesta tests). The module-internal helpers
  // (mergeAugmentMods, fiestaApplyAugments, fiestaDownEntity, fiestaRevive,
  // fiestaPresentPending, fiestaPickOffers, fiestaRingDamage, fiestaUpdatePowerups,
  // fiestaSpawnPowerup, fiestaGrabPowerup) have no foreign caller and live only in
  // the module. playerMods (above) + fiestaMatchInfo (below) STAY on Sim.
  // -------------------------------------------------------------------------

  private clearFiestaAugments(meta: PlayerMeta, e: Entity): void {
    fiestaMod.clearFiestaAugments(meta, e);
  }

  private fiestaStandardize(meta: PlayerMeta, e: Entity): void {
    fiestaMod.fiestaStandardize(this.ctx, meta, e);
  }

  private fiestaRestoreChar(meta: PlayerMeta, e: Entity): void {
    fiestaMod.fiestaRestoreChar(meta, e);
  }

  arenaAugmentPick(augmentId: string, pid?: number): void {
    fiestaMod.arenaAugmentPick(this.ctx, augmentId, pid);
  }

  private fiestaRespawnTime(deaths: number, elapsed: number): number {
    return fiestaMod.fiestaRespawnTime(deaths, elapsed);
  }

  private fiestaDown(match: ArenaMatch, victim: Entity, killerPid: number | null): void {
    fiestaMod.fiestaDown(this.ctx, match, victim, killerPid);
  }

  private fiestaTakedown(match: ArenaMatch, killerPid: number, victim: Entity): void {
    fiestaMod.fiestaTakedown(this.ctx, match, killerPid, victim);
  }

  private fiestaOpenWave(match: ArenaMatch): void {
    fiestaMod.fiestaOpenWave(this.ctx, match);
  }

  private updateFiestaActive(match: ArenaMatch): void {
    fiestaMod.updateFiestaActive(this.ctx, match);
  }

  // -------------------------------------------------------------------------
  // 2v2 Fiesta: OFFLINE/DEV practice vs bots. The harness (spawn + queue + steer
  // three AI player bots) MOVED to social/fiesta_bots.ts (A3). It is offline-only
  // and reaches deep into Sim (casting, auto-attack, movement, add/remove player),
  // so its functions take the Sim directly rather than polluting the seam with a
  // dozen offline-only callbacks; arena queue/return helpers route through the
  // arena module. fiestaBotPids STAYS a Sim field (the E1 "state stays on Sim"
  // pattern) so the module reads/writes it via sim.fiestaBotPids and the existing
  // tests' (sim as any).fiestaBotPids reads resolve unchanged. Sim keeps the four
  // public delegates so main.ts (offline loop) + tests resolve unchanged.
  // -------------------------------------------------------------------------

  fiestaBotPids: number[] = [];

  fiestaPracticeActive(): boolean {
    return fiestaBotsMod.fiestaPracticeActive(this);
  }

  startFiestaPractice(): boolean {
    return fiestaBotsMod.startFiestaPractice(this);
  }

  stopFiestaPractice(): void {
    fiestaBotsMod.stopFiestaPractice(this);
  }

  updateFiestaBots(): void {
    fiestaBotsMod.updateFiestaBots(this);
  }

  private fiestaMatchInfo(
    match: ArenaMatch,
    pid: number,
    team: 'A' | 'B',
  ): import('../world_api').FiestaMatchInfo {
    const f = match.fiesta!;
    const origin = arenaOrigin(match.slot);
    const meta = this.players.get(pid);
    const offer = f.offers.get(pid);
    const respawn = f.respawn.get(pid) ?? 0;
    const roster = (pids: number[]): import('../world_api').FiestaScoreboardPlayer[] =>
      pids.map((p) => {
        const m = this.players.get(p);
        const _e = this.entities.get(p);
        return {
          pid: p,
          name: m?.name ?? '?',
          cls: m?.cls ?? 'warrior',
          kills: f.kills.get(p) ?? 0,
          down: f.respawn.has(p),
          me: p === pid,
        };
      });
    const powerups = f.powerups.map((p) => ({
      id: p.id,
      defId: p.defId,
      x: p.x,
      z: p.z,
      state: p.state,
      frac:
        p.state === 'spawning'
          ? 1 - Math.max(0, p.timer) / FIESTA_POWERUP_TELEGRAPH
          : Math.max(0, p.timer) / FIESTA_POWERUP_TTL,
      color: POWERUPS_BY_ID[p.defId]?.color ?? 0xffffff,
    }));
    return {
      team,
      scoreA: f.scoreA,
      scoreB: f.scoreB,
      myScore: team === 'A' ? f.scoreA : f.scoreB,
      theirScore: team === 'A' ? f.scoreB : f.scoreA,
      scoreLimit: f.scoreLimit,
      wave: f.wave,
      totalWaves: FIESTA_TOTAL_WAVES,
      ring: { cx: origin.x + FIESTA_RING_CX, cz: origin.z + FIESTA_RING_CZ, radius: f.ringRadius },
      down: f.respawn.has(pid),
      respawnIn: Math.ceil(respawn),
      augments: meta ? [...meta.fiestaAugments] : [],
      offer: offer ? { tier: offer.tier, wave: offer.wave, choices: [...offer.choices] } : null,
      augmentPending: f.pending.get(pid)?.length ?? 0,
      teamA: roster(match.teamA),
      teamB: roster(match.teamB),
      powerups,
    };
  }

  // Live standings of rated players currently online, best first.
  arenaLadder(format: ArenaFormat = '1v1'): import('../world_api').ArenaLadderEntry[] {
    const rows: import('../world_api').ArenaLadderEntry[] = [];
    for (const meta of this.players.values()) {
      const e = this.entities.get(meta.entityId);
      if (!e) continue;
      const standing = this.arenaStanding(meta, format);
      rows.push({
        pid: meta.entityId,
        name: meta.name,
        cls: meta.cls,
        rating: standing.rating,
        wins: standing.wins,
        losses: standing.losses,
      });
    }
    rows.sort((x, y) => y.rating - x.rating || y.wins - x.wins);
    return rows.slice(0, ARENA_LADDER_SIZE);
  }

  arenaInfoFor(pid: number): import('../world_api').ArenaInfo | null {
    const meta = this.players.get(pid);
    if (!meta) return null;
    const match = this.arenaMatches.get(pid);
    const queuedFmt = this.arenaQueuedFormat(pid);
    let matchInfo: import('../world_api').ArenaInfo['match'] = null;
    if (match) {
      const myTeam = this.arenaTeamOf(match, pid);
      if (myTeam) {
        const allyPids = (myTeam === 'A' ? match.teamA : match.teamB).filter((p) => p !== pid);
        const enemyPids = myTeam === 'A' ? match.teamB : match.teamA;
        const allies = this.arenaCombatants(allyPids);
        const enemies = this.arenaCombatants(enemyPids);
        const primary = enemies[0];
        if (primary) {
          matchInfo = {
            format: match.format,
            state: match.state,
            oppName: enemies.map((e) => e.name).join(' & '),
            oppClass: primary.cls,
            oppLevel: primary.level,
            oppPid: primary.pid,
            allies,
            enemies,
            returnIn: match.state === 'over' ? Math.max(0, Math.ceil(match.timer)) : undefined,
            fiesta: match.fiesta ? this.fiestaMatchInfo(match, pid, myTeam) : undefined,
          };
        }
      }
    }
    const standings: Record<ArenaFormat, ArenaStanding> = {
      '1v1': this.arenaStanding(meta, '1v1'),
      '2v2': this.arenaStanding(meta, '2v2'),
      // Fiesta is unranked party play — it keeps no standing of its own; mirror
      // 2v2 just to satisfy the bracket record (the Fiesta UI never reads it).
      fiesta: this.arenaStanding(meta, '2v2'),
    };
    const ladders: Record<ArenaFormat, import('../world_api').ArenaLadderEntry[]> = {
      '1v1': this.arenaLadder('1v1'),
      '2v2': this.arenaLadder('2v2'),
      fiesta: [],
    };
    const format = match?.format ?? queuedFmt;
    const readoutFormat = format ?? '1v1';
    const standing = standings[readoutFormat];
    const playerCount = (q: ArenaQueueUnit[]) => q.reduce((n, u) => n + u.pids.length, 0);
    const queueSize =
      format === 'fiesta'
        ? playerCount(this.arenaQueueFiesta)
        : format === '2v2'
          ? playerCount(this.arenaQueue2v2)
          : format === '1v1'
            ? this.arenaQueue1v1.length
            : 0;
    return {
      rating: standing.rating,
      wins: standing.wins,
      losses: standing.losses,
      standings,
      format,
      queued: queuedFmt !== null,
      queueSize,
      match: matchInfo,
      ladder: ladders[readoutFormat],
      ladders,
    };
  }

  // -------------------------------------------------------------------------
  // Trading
  // -------------------------------------------------------------------------

  tradeRequest(targetPid: number, pid?: number): void {
    const r = this.resolve(pid);
    const target = this.players.get(targetPid);
    const targetE = this.entities.get(targetPid);
    if (!r || !target || !targetE) return;
    if (targetPid === r.meta.entityId) return;
    if (this.trades.has(r.meta.entityId) || this.trades.has(targetPid)) {
      this.error(r.meta.entityId, 'A trade is already in progress.');
      return;
    }
    if (dist2d(r.e.pos, targetE.pos) > TRADE_RANGE) {
      this.error(r.meta.entityId, 'Target is too far away to trade.');
      return;
    }
    if (this.hasPendingSocialInvite(targetPid)) {
      this.error(r.meta.entityId, `${target.name} already has a pending invitation.`);
      return;
    }
    this.tradeInvites.set(targetPid, { fromPid: r.meta.entityId, expires: this.time + 30 });
    this.emit({
      type: 'tradeRequest',
      fromPid: r.meta.entityId,
      fromName: r.meta.name,
      pid: targetPid,
    });
    this.emit({
      type: 'log',
      text: `You have requested to trade with ${target.name}.`,
      color: '#8df',
      pid: r.meta.entityId,
    });
  }

  tradeAccept(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const invite = this.tradeInvites.get(r.meta.entityId);
    if (!invite || invite.expires < this.time) {
      this.error(r.meta.entityId, 'The trade request has expired.');
      return;
    }
    this.tradeInvites.delete(r.meta.entityId);
    if (!this.players.get(invite.fromPid)) return;
    if (this.trades.has(invite.fromPid) || this.trades.has(r.meta.entityId)) {
      this.error(r.meta.entityId, 'That player is already trading.');
      return;
    }
    const session: TradeSession = {
      a: invite.fromPid,
      b: r.meta.entityId,
      offerA: { items: [], copper: 0 },
      offerB: { items: [], copper: 0 },
      acceptedA: false,
      acceptedB: false,
    };
    this.trades.set(session.a, session);
    this.trades.set(session.b, session);
    for (const tPid of [session.a, session.b]) {
      this.emit({ type: 'log', text: 'Trade window opened.', color: '#8df', pid: tPid });
    }
  }

  tradeSetOffer(items: InvSlot[], copper: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const session = this.trades.get(r.meta.entityId);
    if (!session) return;
    // validate the offer against the player's bags; merge duplicate slots so
    // the offered total per item is checked, not each slot in isolation
    const merged = new Map<string, number>();
    for (const slot of items.slice(0, 6)) {
      // slots come straight off the wire — reject anything malformed
      if (!slot || typeof slot.itemId !== 'string' || !Number.isFinite(slot.count)) continue;
      const count = Math.max(1, Math.floor(slot.count));
      const def = ITEMS[slot.itemId];
      if (!def || def.kind === 'quest') continue; // quest items are soulbound-ish
      merged.set(slot.itemId, (merged.get(slot.itemId) ?? 0) + count);
    }
    const cleaned: InvSlot[] = [];
    for (const [itemId, count] of merged) {
      if (this.countItem(itemId, r.meta.entityId) < count) continue;
      cleaned.push({ itemId, count });
    }
    const offer = {
      items: cleaned,
      copper: Math.max(0, Math.min(Math.floor(copper), r.meta.copper)),
    };
    if (session.a === r.meta.entityId) session.offerA = offer;
    else session.offerB = offer;
    session.acceptedA = false;
    session.acceptedB = false;
  }

  tradeConfirm(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const session = this.trades.get(r.meta.entityId);
    if (!session) return;
    if (session.a === r.meta.entityId) session.acceptedA = true;
    else session.acceptedB = true;
    if (!(session.acceptedA && session.acceptedB)) return;

    const metaA = this.players.get(session.a);
    const metaB = this.players.get(session.b);
    if (!metaA || !metaB) {
      this.tradeCancel(session.a);
      return;
    }
    // final validation before the atomic swap
    const valid =
      session.offerA.copper <= metaA.copper &&
      session.offerB.copper <= metaB.copper &&
      this.offerCovered(session.offerA.items, session.a) &&
      this.offerCovered(session.offerB.items, session.b);
    if (!valid) {
      for (const tPid of [session.a, session.b])
        this.error(tPid, 'Trade failed: items or money no longer available.');
      this.closeTrade(session);
      return;
    }
    // swap
    metaA.copper = metaA.copper - session.offerA.copper + session.offerB.copper;
    metaB.copper = metaB.copper - session.offerB.copper + session.offerA.copper;
    for (const s of session.offerA.items) {
      this.removeItem(s.itemId, s.count, session.a);
      this.addItem(s.itemId, s.count, session.b);
    }
    for (const s of session.offerB.items) {
      this.removeItem(s.itemId, s.count, session.b);
      this.addItem(s.itemId, s.count, session.a);
    }
    for (const tPid of [session.a, session.b]) {
      this.emit({ type: 'log', text: 'Trade complete.', color: '#8df', pid: tPid });
      this.emit({ type: 'tradeDone', pid: tPid });
    }
    this.closeTrade(session);
  }

  tradeCancel(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const session = this.trades.get(r.meta.entityId);
    if (!session) return;
    for (const tPid of [session.a, session.b]) {
      this.emit({ type: 'log', text: 'Trade cancelled.', color: '#8df', pid: tPid });
    }
    this.closeTrade(session);
  }

  // true when the player's bags cover the offered totals per item, summing
  // duplicate slots — a per-slot check would let duplicates each pass alone
  private offerCovered(items: InvSlot[], pid: number): boolean {
    const totals = new Map<string, number>();
    for (const s of items) totals.set(s.itemId, (totals.get(s.itemId) ?? 0) + s.count);
    for (const [itemId, count] of totals) {
      if (this.countItem(itemId, pid) < count) return false;
    }
    return true;
  }

  private closeTrade(session: TradeSession): void {
    this.trades.delete(session.a);
    this.trades.delete(session.b);
  }

  tradeFor(pid: number): TradeSession | null {
    return this.trades.get(pid) ?? null;
  }

  private updateTradesAndInvites(): void {
    // expire stale invites (partyInvites is the PartyMachine's field now, A1)
    for (const map of [this.party.partyInvites, this.tradeInvites, this.duelInvites]) {
      for (const [pid, invite] of map) {
        if (invite.expires < this.time) map.delete(pid);
      }
    }
    // cancel trades when the parties drift apart
    const seen = new Set<TradeSession>();
    for (const session of this.trades.values()) {
      if (seen.has(session)) continue;
      seen.add(session);
      const ea = this.entities.get(session.a);
      const eb = this.entities.get(session.b);
      if (!ea || !eb || dist2d(ea.pos, eb.pos) > TRADE_RANGE + 4 || ea.dead || eb.dead) {
        this.tradeCancel(session.a);
      }
    }
  }

  // -------------------------------------------------------------------------
  // The World Market — the Merchant's auction house
  // -------------------------------------------------------------------------

  private merchantEntity(): Entity | null {
    const e = this.entities.get(this.merchantId);
    return e && e.kind === 'npc' ? e : null;
  }

  private nearMerchant(e: Entity): boolean {
    const m = this.merchantEntity();
    return !!m && dist2d(e.pos, m.pos) <= MARKET_RANGE;
  }

  private marketSellerKey(meta: PlayerMeta): string {
    return String(meta.characterId ?? meta.entityId);
  }

  private marketListingBelongsTo(listing: MarketListing, meta: PlayerMeta): boolean {
    if (listing.house) return false;
    return listing.sellerKey === this.marketSellerKey(meta) || listing.sellerKey === meta.name;
  }

  private metaByMarketSellerKey(key: string): PlayerMeta | null {
    if (!key) return null;
    for (const m of this.players.values()) {
      if (this.marketSellerKey(m) === key || m.name === key) return m;
    }
    return null;
  }

  private collectionFor(key: string): MarketCollection {
    let c = this.marketCollections.get(key);
    if (!c) {
      c = { copper: 0, items: [] };
      this.marketCollections.set(key, c);
    }
    return c;
  }

  private mergeMarketCollections(fromKey: string, toKey: string): boolean {
    if (!fromKey || fromKey === toKey) return false;
    const from = this.marketCollections.get(fromKey);
    if (!from) return false;
    const to = this.collectionFor(toKey);
    to.copper += from.copper;
    to.items.push(...from.items.map((s) => ({ ...s })));
    this.marketCollections.delete(fromKey);
    return true;
  }

  private collectionForSeller(meta: PlayerMeta): MarketCollection | undefined {
    const key = this.marketSellerKey(meta);
    this.mergeMarketCollections(meta.name, key);
    return this.marketCollections.get(key);
  }

  rekeyMarketSeller(characterId: number, oldName: string, newName: string): boolean {
    if (!Number.isFinite(characterId)) return false;
    const key = String(characterId);
    let changed = this.mergeMarketCollections(oldName, key);
    changed = this.mergeMarketCollections(newName, key) || changed;
    for (const listing of this.marketListings) {
      if (listing.house) continue;
      if (
        listing.sellerKey === key ||
        listing.sellerKey === oldName ||
        listing.sellerKey === newName
      ) {
        if (listing.sellerKey !== key || listing.sellerName !== newName) changed = true;
        listing.sellerKey = key;
        listing.sellerName = newName;
      }
    }
    return changed;
  }

  // The Merchant always keeps a little stock so the market is never empty —
  // standing consignments that never expire, never deplete, and pay no one.
  private seedHouseListings(): void {
    const stock: { itemId: string; count: number; price: number }[] = [
      { itemId: 'roasted_boar', count: 5, price: 700 },
      { itemId: 'spring_water', count: 5, price: 160 },
      { itemId: 'oiled_boots', count: 1, price: 1900 },
      { itemId: 'quilted_trousers', count: 1, price: 2400 },
      { itemId: 'greyjaw_pelt_cloak', count: 1, price: 2900 },
      // Quartermaster's Consignment — a standing line of practical travel gear.
      { itemId: 'roadwardens_helm', count: 1, price: 2200 },
      { itemId: 'wayfarers_hood', count: 1, price: 2000 },
      { itemId: 'acolytes_circlet', count: 1, price: 2000 },
      { itemId: 'reinforced_pauldrons', count: 1, price: 2400 },
      { itemId: 'embroidered_mantle', count: 1, price: 1900 },
      { itemId: 'sturdy_belt', count: 1, price: 1700 },
      { itemId: 'silk_sash', count: 1, price: 1700 },
      { itemId: 'roughspun_gloves', count: 1, price: 1500 },
      // Crossroads Outfitters — eight pieces kept in standing stock
      { itemId: 'tradesman_hatchet', count: 1, price: 2300 },
      { itemId: 'drovers_staff', count: 1, price: 2500 },
      { itemId: 'caravan_warden_dirk', count: 1, price: 2400 },
      { itemId: 'outrider_brigandine', count: 1, price: 2600 },
      { itemId: 'caravan_quilted_vest', count: 1, price: 1800 },
      { itemId: 'outrider_legguards', count: 1, price: 2100 },
      { itemId: 'pilgrims_leggings', count: 1, price: 1700 },
      { itemId: 'outrider_sabatons', count: 1, price: 1900 },
    ];
    for (const s of stock) {
      if (!ITEMS[s.itemId]) continue;
      this.marketListings.push({
        id: this.nextListingId++,
        sellerKey: '',
        sellerName: 'The Merchant',
        itemId: s.itemId,
        count: s.count,
        price: s.price,
        expiresAt: Infinity,
        house: true,
      });
    }
  }

  // List a stack from your bags for sale. The goods are escrowed (pulled from
  // your bags immediately) and held by the Merchant until bought or reclaimed.
  // Set the player's session-only World Market browse filter. Purely a
  // display/query narrowing — no gameplay effect — so it needs no proximity or
  // liveness gate; the next marketInfoFor snapshot reflects it.
  marketSearch(query: string, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    r.meta.marketFilter = (query ?? '').slice(0, 40);
  }

  marketList(itemId: string, count: number, price: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    if (p.dead) return;
    if (!this.nearMerchant(p)) {
      this.error(meta.entityId, 'You must bring your goods to the Merchant.');
      return;
    }
    const def = ITEMS[itemId];
    if (!def) return;
    if (def.kind === 'quest') {
      this.error(meta.entityId, 'The Merchant will not broker quest items.');
      return;
    }
    if (def.noMarketList) {
      this.error(meta.entityId, 'That item cannot be listed on the World Market.');
      return;
    }
    if (!Number.isFinite(count)) {
      this.error(meta.entityId, 'Name how many you wish to sell.');
      return;
    }
    const want = Math.max(1, Math.floor(count));
    if (this.countItem(itemId, meta.entityId) < want) {
      this.error(meta.entityId, 'You do not have that many to sell.');
      return;
    }
    const ask = Math.floor(price);
    if (!Number.isFinite(ask) || ask < MARKET_MIN_PRICE) {
      this.error(meta.entityId, 'Name a price of at least 1 copper.');
      return;
    }
    if (ask > MARKET_MAX_PRICE) {
      this.error(meta.entityId, 'That price is beyond what the Merchant will broker.');
      return;
    }
    const sellerKey = this.marketSellerKey(meta);
    const mine = this.marketListings.reduce(
      (n, l) => n + (this.marketListingBelongsTo(l, meta) ? 1 : 0),
      0,
    );
    if (mine >= MARKET_MAX_LISTINGS) {
      this.error(
        meta.entityId,
        `You may keep at most ${MARKET_MAX_LISTINGS} goods on the market at once.`,
      );
      return;
    }
    this.removeItem(itemId, want, meta.entityId); // escrow
    this.marketListings.push({
      id: this.nextListingId++,
      sellerKey,
      sellerName: meta.name,
      itemId,
      count: want,
      price: ask,
      expiresAt: this.time + MARKET_LISTING_DURATION,
      house: false,
    });
    this.emit({
      type: 'loot',
      // biome-ignore lint/style/useTemplate: keep this scanner-friendly shape for i18n extraction.
      text: `Listed ${def.name}${want > 1 ? ' x' + want : ''} on the World Market for ${formatMoney(ask)}.`,
      pid: meta.entityId,
    });
  }

  // Buy a listing outright. Coin leaves the buyer, goods enter their bags, and
  // the seller's proceeds (less the Merchant's cut) wait in their collection.
  marketBuy(listingId: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    if (p.dead) return;
    if (!this.nearMerchant(p)) {
      this.error(meta.entityId, 'You are too far from the Merchant.');
      return;
    }
    const idx = this.marketListings.findIndex((l) => l.id === listingId);
    if (idx < 0) {
      this.error(meta.entityId, 'That listing is no longer available.');
      return;
    }
    const listing = this.marketListings[idx];
    const def = ITEMS[listing.itemId];
    if (!def) {
      this.marketListings.splice(idx, 1);
      return;
    }
    if (this.marketListingBelongsTo(listing, meta)) {
      this.error(meta.entityId, 'That is your own listing — cancel it to reclaim it.');
      return;
    }
    if (meta.copper < listing.price) {
      this.error(meta.entityId, 'You cannot afford that.');
      return;
    }
    meta.copper -= listing.price;
    this.addItem(listing.itemId, listing.count, meta.entityId);
    if (!listing.house) {
      const proceeds = Math.max(0, Math.floor(listing.price * (1 - MARKET_CUT)));
      this.collectionFor(listing.sellerKey).copper += proceeds;
      this.marketListings.splice(idx, 1);
      const sellerMeta = this.metaByMarketSellerKey(listing.sellerKey);
      if (sellerMeta) {
        this.emit({
          type: 'loot',
          text: `${meta.name} bought your ${def.name} for ${formatMoney(listing.price)} - collect ${formatMoney(proceeds)} from the Merchant.`,
          pid: sellerMeta.entityId,
        });
      }
    }
    this.emit({
      type: 'loot',
      // biome-ignore lint/style/useTemplate: keep this scanner-friendly shape for i18n extraction.
      text: `Bought ${def.name}${listing.count > 1 ? ' x' + listing.count : ''} for ${formatMoney(listing.price)}.`,
      pid: meta.entityId,
    });
  }

  // Reclaim your own listing; the escrowed goods go straight back to your bags.
  marketCancel(listingId: number, pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    if (!this.nearMerchant(p)) {
      this.error(meta.entityId, 'You are too far from the Merchant.');
      return;
    }
    const idx = this.marketListings.findIndex((l) => l.id === listingId);
    if (idx < 0) return;
    const listing = this.marketListings[idx];
    if (!this.marketListingBelongsTo(listing, meta)) {
      this.error(meta.entityId, 'That is not your listing.');
      return;
    }
    this.marketListings.splice(idx, 1);
    this.addItem(listing.itemId, listing.count, meta.entityId);
    const def = ITEMS[listing.itemId];
    this.emit({
      type: 'loot',
      // biome-ignore lint/style/useTemplate: keep this scanner-friendly shape for i18n extraction.
      text: `Reclaimed ${def?.name ?? listing.itemId}${listing.count > 1 ? ' x' + listing.count : ''} from the market.`,
      pid: meta.entityId,
    });
  }

  // Take everything waiting for you at the Merchant: sale gold and any items
  // returned from expired listings.
  marketCollect(pid?: number): void {
    const r = this.resolve(pid);
    if (!r) return;
    const { meta, e: p } = r;
    if (!this.nearMerchant(p)) {
      this.error(meta.entityId, 'You are too far from the Merchant.');
      return;
    }
    const col = this.collectionForSeller(meta);
    if (!col || (col.copper <= 0 && col.items.length === 0)) {
      this.error(meta.entityId, 'You have nothing to collect.');
      return;
    }
    if (col.copper > 0) {
      meta.copper += col.copper;
      this.emit({
        type: 'loot',
        text: `You collect ${formatMoney(col.copper)} from the Merchant.`,
        pid: meta.entityId,
      });
    }
    for (const s of col.items) this.addItem(s.itemId, s.count, meta.entityId);
    this.marketCollections.delete(this.marketSellerKey(meta));
  }

  // Once a second: return expired player listings to their seller's collection.
  private updateMarket(): void {
    if (this.tickCount % 20 !== 0) return;
    for (let i = this.marketListings.length - 1; i >= 0; i--) {
      const l = this.marketListings[i];
      if (l.house || this.time < l.expiresAt) continue;
      this.marketListings.splice(i, 1);
      this.collectionFor(l.sellerKey).items.push({ itemId: l.itemId, count: l.count });
      const sellerMeta = this.metaByMarketSellerKey(l.sellerKey);
      if (sellerMeta) {
        const def = ITEMS[l.itemId];
        this.emit({
          type: 'log',
          text: `Your market listing of ${def?.name ?? l.itemId} expired and waits at the Merchant.`,
          color: '#caa472',
          pid: sellerMeta.entityId,
        });
      }
    }
  }

  marketInfoFor(pid: number): import('../world_api').MarketInfo | null {
    const meta = this.players.get(pid);
    const e = this.entities.get(pid);
    if (!meta || !e) return null;
    // the World Market is a place you visit — only stream it while standing by
    // the Merchant, which also bounds the per-snapshot wire cost
    if (!this.nearMerchant(e)) return null;
    // Server-side browse filter: a substring match on item name (and id) lets a
    // player reach goods past MARKET_WIRE_LIMIT without lifting the wire cap.
    const filter = meta.marketFilter.trim().toLowerCase();
    const matched = filter
      ? this.marketListings.filter((l) => {
          const name = (ITEMS[l.itemId]?.name ?? l.itemId).toLowerCase();
          return name.includes(filter) || l.itemId.toLowerCase().includes(filter);
        })
      : this.marketListings;
    const sorted = [...matched].sort((a, b) => {
      const na = ITEMS[a.itemId]?.name ?? a.itemId;
      const nb = ITEMS[b.itemId]?.name ?? b.itemId;
      return na.localeCompare(nb) || a.price - b.price;
    });
    // Always wire the seller their own listings first, then fill the rest of the
    // wire budget with everyone else's. Without this, on a busy shared market a
    // seller's goods can sort past MARKET_WIRE_LIMIT and never reach them — the
    // SELL tab would then read "12/12" while only a handful of their listings
    // are visible. MARKET_MAX_LISTINGS (12) ≪ MARKET_WIRE_LIMIT (120), so a
    // seller's own goods always fit alongside a healthy slice of the market.
    const isMine = (l: MarketListing) => this.marketListingBelongsTo(l, meta);
    const mineSorted = sorted.filter(isMine);
    const others = sorted.filter((l) => !isMine(l));
    const wired = [
      ...mineSorted,
      ...others.slice(0, Math.max(0, MARKET_WIRE_LIMIT - mineSorted.length)),
    ];
    const listings = wired.map((l) => ({
      id: l.id,
      sellerName: isMine(l) ? meta.name : l.sellerName,
      itemId: l.itemId,
      count: l.count,
      price: l.price,
      mine: isMine(l),
      house: l.house,
    }));
    const col = this.collectionForSeller(meta);
    const myListingCount = this.marketListings.reduce(
      (n, l) => n + (this.marketListingBelongsTo(l, meta) ? 1 : 0),
      0,
    );
    return {
      listings,
      totalCount: matched.length,
      filter: meta.marketFilter,
      collectionCopper: col?.copper ?? 0,
      collectionItems: col ? col.items.map((s) => ({ ...s })) : [],
      cutPct: Math.round(MARKET_CUT * 100),
      maxListings: MARKET_MAX_LISTINGS,
      myListingCount,
    };
  }

  // Persist only player listings + collections; house stock is reseeded each
  // boot so content edits take effect. secondsLeft survives the time reset.
  serializeMarket(): MarketSave {
    return {
      listings: this.marketListings
        .filter((l) => !l.house)
        .map((l) => ({
          id: l.id,
          sellerKey: l.sellerKey,
          sellerName: l.sellerName,
          itemId: l.itemId,
          count: l.count,
          price: l.price,
          secondsLeft: Number.isFinite(l.expiresAt)
            ? Math.max(0, Math.round(l.expiresAt - this.time))
            : MARKET_LISTING_DURATION,
        })),
      collections: [...this.marketCollections.entries()].map(([key, c]) => ({
        key,
        copper: c.copper,
        items: c.items.map((s) => ({ ...s })),
      })),
      nextListingId: this.nextListingId,
    };
  }

  loadMarket(save: MarketSave | null | undefined): void {
    if (!save) return;
    for (const l of save.listings ?? []) {
      if (!l || typeof l.itemId !== 'string' || !ITEMS[l.itemId]) continue;
      this.marketListings.push({
        id: l.id,
        sellerKey: String(l.sellerKey ?? ''),
        sellerName: String(l.sellerName ?? l.sellerKey ?? '?'),
        itemId: l.itemId,
        count: Math.max(1, l.count | 0),
        price: Math.max(
          MARKET_MIN_PRICE,
          Math.min(MARKET_MAX_PRICE, Math.floor(l.price) || MARKET_MIN_PRICE),
        ),
        expiresAt:
          this.time +
          (Number.isFinite(l.secondsLeft) ? Math.max(0, l.secondsLeft) : MARKET_LISTING_DURATION),
        house: false,
      });
    }
    for (const c of save.collections ?? []) {
      if (!c || typeof c.key !== 'string') continue;
      this.marketCollections.set(c.key, {
        copper: Math.max(0, Math.floor(c.copper) || 0),
        items: (c.items ?? [])
          .filter((s) => s && ITEMS[s.itemId])
          .map((s) => ({ itemId: s.itemId, count: Math.max(1, s.count | 0) })),
      });
    }
    const maxId = this.marketListings.reduce((m, l) => Math.max(m, l.id + 1), 1);
    this.nextListingId = Math.max(this.nextListingId, save.nextListingId ?? 1, maxId);
  }

  // -------------------------------------------------------------------------
  // Dungeons: party-instanced elite content (the Hollow Crypt and friends)
  // -------------------------------------------------------------------------

  // The dungeon-instancing slice now lives in instances/dungeons.ts (I1, moved behind
  // SimContext). These are same-named thin delegates so every foreign `this.X` call
  // site + the tick loop resolve unchanged; the in-module helpers (canEnterNythraxisRaid/
  // isRaidLocked/nythraxisInstanceSealed/claimInstance/freeInstance) have no Sim caller
  // and live only in the module. The instance pool (`this.instances`) and door-id cache
  // (`dungeonDoorIds`) stay Sim-owned fields, exposed to the module as live SimContext views.

  private instanceKeyFor(pid: number): string {
    return instanceKeyForImpl(this.ctx, pid);
  }

  private instanceOriginOf(inst: InstanceSlot): { x: number; z: number } {
    return instanceOriginOfImpl(inst);
  }

  // Lazily built on first updateDoorTriggers, then appended on dungeon_door spawn
  // (entity_roster.addEntityToRoster). Stays Sim-owned; reached via ctx.dungeonDoorIds.
  private dungeonDoorIds: number[] | null = null;

  private updateDoorTriggers(p: Entity): void {
    updateDoorTriggersImpl(this.ctx, p);
  }

  enterDungeon(dungeonId: string, pid?: number): void {
    enterDungeonImpl(this.ctx, dungeonId, pid);
  }

  leaveDungeon(pid?: number): void {
    leaveDungeonImpl(this.ctx, pid);
  }

  // Legacy single-dungeon entry points (tests + scripts use these).
  enterCrypt(pid?: number): void {
    enterCryptImpl(this.ctx, pid);
  }

  leaveCrypt(pid?: number): void {
    leaveCryptImpl(this.ctx, pid);
  }

  private updateInstances(): void {
    updateInstancesImpl(this.ctx);
  }

  // UI-facing info objects (the same shapes the server sends over the wire)
  get partyInfo(): import('../world_api').PartyInfo | null {
    const party = this.partyOf(this.primaryId);
    if (!party) return null;
    return {
      leader: party.leader,
      raid: party.raid,
      members: party.members.flatMap((mPid) => {
        const meta = this.players.get(mPid);
        const e = this.entities.get(mPid);
        return meta && e
          ? [
              {
                pid: mPid,
                name: meta.name,
                cls: meta.cls,
                level: e.level,
                hp: e.hp,
                mhp: e.maxHp,
                res: Math.round(e.resource),
                mres: e.maxResource,
                rtype: e.resourceType,
                x: e.pos.x,
                z: e.pos.z,
                dead: e.dead ? 1 : 0,
                inCombat: e.inCombat ? 1 : 0,
                group: party.raidGroups.get(mPid) ?? 1,
              },
            ]
          : [];
      }),
    };
  }

  get tradeInfo(): import('../world_api').TradeInfo | null {
    const t = this.tradeFor(this.primaryId);
    if (!t) return null;
    const mine = t.a === this.primaryId;
    const otherPid = mine ? t.b : t.a;
    return {
      otherPid,
      otherName: this.players.get(otherPid)?.name ?? '?',
      myOffer: mine ? t.offerA : t.offerB,
      theirOffer: mine ? t.offerB : t.offerA,
      myAccepted: mine ? t.acceptedA : t.acceptedB,
      theirAccepted: mine ? t.acceptedB : t.acceptedA,
    };
  }

  get duelInfo(): import('../world_api').DuelInfo | null {
    const d = this.duelFor(this.primaryId);
    if (!d) return null;
    const otherPid = d.a === this.primaryId ? d.b : d.a;
    return { otherPid, otherName: this.players.get(otherPid)?.name ?? '?', state: d.state };
  }

  get arenaInfo(): import('../world_api').ArenaInfo | null {
    return this.primaryId === -1 ? null : this.arenaInfoFor(this.primaryId);
  }

  get marketInfo(): import('../world_api').MarketInfo | null {
    return this.primaryId === -1 ? null : this.marketInfoFor(this.primaryId);
  }

  instanceSlotAt(pos: Vec3): number | null {
    return instanceSlotAtImpl(this.ctx, pos);
  }

  // Builds the self-only "/stats" readout line from live entity state. The
  // resource clause is dropped for classes whose resourceType is null.
  private statsReadout(meta: PlayerMeta, e: Entity): string {
    const className = CLASSES[meta.cls].name;
    const crit = (e.critChance * 100).toFixed(1);
    let line = `Level ${e.level} ${className} — HP ${Math.round(e.hp)}/${Math.round(e.maxHp)}`;
    if (e.resourceType) {
      const res = e.resourceType.charAt(0).toUpperCase() + e.resourceType.slice(1);
      line += `, ${res} ${Math.round(e.resource)}/${Math.round(e.maxResource)}`;
    }
    line += `. AP ${Math.round(e.attackPower)}, Crit ${crit}%, Armor ${Math.round(e.stats.armor)}.`;
    return line;
  }
  // Self-only readout of carried items for "/bags": items sorted by quality
  // (epic first), ties keeping inventory order, with the purse appended via
  // formatMoney. Reads only PlayerMeta state, so it works online for free.
  private bagsReadout(meta: PlayerMeta): string {
    const purse = `Purse: ${formatMoney(meta.copper)}.`;
    if (meta.inventory.length === 0) return `Your bags are empty. ${purse}`;
    const rank: Record<string, number> = { epic: 0, rare: 1, uncommon: 2, common: 3, poor: 4 };
    const sorted = meta.inventory
      .map((s, i) => ({ s, i }))
      .sort((a, b) => {
        const qa = rank[ITEMS[a.s.itemId]?.quality ?? 'common'] ?? 3;
        const qb = rank[ITEMS[b.s.itemId]?.quality ?? 'common'] ?? 3;
        return qa - qb || a.i - b.i;
      });
    const parts = sorted.map(({ s }) => {
      const name = ITEMS[s.itemId]?.name ?? s.itemId;
      return s.count > 1 ? `${name} x${s.count}` : name;
    });
    return `Bags (${parts.length}): ${parts.join(', ')}. ${purse}`;
  }
  // Self-only readout of the player's party: each member in join order with
  // level, class, and HP% (or (dead)/(offline)), the leader tagged [leader].
  private partyReadout(pid: number): string {
    const party = this.partyOf(pid);
    if (!party) return 'You are not in a party.';
    const parts = party.members.map((mPid) => {
      const meta = this.players.get(mPid);
      const e = this.entities.get(mPid);
      if (!meta || !e) return meta ? `${meta.name} (offline)` : `Player ${mPid} (offline)`;
      const cls = CLASSES[meta.cls].name;
      const state = e.hp <= 0 ? '(dead)' : `${Math.round((e.hp / e.maxHp) * 100)}%`;
      const tag = mPid === party.leader ? ' [leader]' : '';
      return `${meta.name} (Lvl ${e.level} ${cls}, ${state})${tag}`;
    });
    return `${party.raid ? 'Raid' : 'Party'} (${party.members.length}/${this.partyCapacity(party)}): ${parts.join(', ')}.`;
  }
  // Self-only readout for "/zones": lists every overworld zone in travel order
  // (south -> north) with its level range, tagging the zone the player is in.
  // `currentZ` is the player's world Z (use zoneAt(currentZ) to find their zone).
  // ZONES is the ordered ZoneDef[] from ./data; each has .name and
  // .levelRange = [min, max].
  private zonesReadout(currentZ: number): string {
    if (ZONES.length === 0) return 'No zones are defined.';
    const here = zoneAt(currentZ);
    const parts = ZONES.map((z) => {
      const line = `${z.name} (Lvl ${z.levelRange[0]}-${z.levelRange[1]})`;
      return z.id === here.id ? `${line} [you are here]` : line;
    });
    return `Zones (${ZONES.length}): ${parts.join(', ')}.`;
  }
  // Self-only readout of a character's Ashen Coliseum standing. Reads only the
  // persisted PlayerMeta arena fields (no new state). Draws count as neither a
  // win nor a loss (see resolveArena), so "matches played" is wins + losses.
  private arenaReadout(meta: PlayerMeta): string {
    const part = (label: ArenaFormat, rating: number, wins: number, losses: number): string => {
      const played = wins + losses;
      if (played <= 0) return `${label} Rating ${rating} - no matches played yet`;
      const pct = Math.round((wins / played) * 100);
      return `${label} Rating ${rating} - ${wins} wins, ${losses} losses (${pct}% win rate)`;
    };
    return `Arena: ${part('1v1', meta.arenaRating, meta.arenaWins, meta.arenaLosses)}. ${part('2v2', meta.arena2v2Rating, meta.arena2v2Wins, meta.arena2v2Losses)}.`;
  }
  private buybackReadout(meta: PlayerMeta): string {
    const slots = meta.vendorBuyback.filter((s) => ITEMS[s.itemId] && s.count > 0);
    if (slots.length === 0) return 'Your vendor buyback list is empty.';
    const parts = slots.map((s) => {
      const def = ITEMS[s.itemId];
      const qty = s.count > 1 ? ` x${s.count}` : '';
      return `${def.name}${qty} (${formatMoney(def.sellValue)} each)`;
    });
    return `Vendor buyback (${slots.length}): ${parts.join(', ')}. Repurchase at any merchant.`;
  }
  private comboReadout(e: Entity): string {
    if (e.comboPoints <= 0) return 'You have no combo points built up.';
    const target = e.comboTargetId !== null ? this.entities.get(e.comboTargetId) : undefined;
    const on = target ? ` on ${target.name}` : '';
    return `Combo points: ${e.comboPoints}/5${on}.`;
  }
  // Readout for "/combat": reads only the live Entity.inCombat / combatTimer
  // (no new fields). combatTimer is "time since last combat event"; a player
  // lingers in combat until it reaches COMBAT_LINGER (the literal 5s drop-out
  // window applied in updatePlayers, sim.ts where inCombat is recomputed). If
  // inCombat is still set past that window, an enemy is actively engaged, so no
  // countdown can be promised.
  private combatReadout(e: Entity): string {
    if (!e.inCombat) return 'You are not in combat.';
    const COMBAT_LINGER = 5;
    const remaining = COMBAT_LINGER - e.combatTimer;
    if (remaining > 0) {
      return `You are in combat — leaving in ${Math.ceil(remaining)}s if no further action.`;
    }
    return 'You are in combat (enemies still engaged).';
  }
  // Readout for "/graveyard": names the zone graveyard your spirit returns to
  // if you die here, and its coordinates. Reads only existing zone/dungeon
  // lookups (no new fields) and resolves the same target as releaseSpirit —
  // dying inside a dungeon resurrects you at the graveyard of the zone its door
  // sits in, dying outdoors at your current zone's graveyard.
  // graveyardReadout moved to entity_roster.ts (pure zone lookup); imported above.
  // Readout for "/dungeons": lists every group instance in entrance order with
  // the overworld zone its door sits in and its suggested party size. Reads
  // only the static DUNGEON_LIST (already entrance-sorted by index) and the
  // door zone via zoneAt — no new fields.
  private dungeonsReadout(): string {
    const parts = DUNGEON_LIST.map(
      (d) => `${d.name} (${zoneAt(d.doorPos.z).name}, ${d.suggestedPlayers} players)`,
    );
    return `Dungeons (${parts.length}): ${parts.join(', ')}.`;
  }
  // Readout for "/consider": sizes up the current target's level versus yours.
  // The verdict bands track the real combat model — meleeMissChance (types.ts)
  // applies a sharp miss penalty once the target is 3+ levels above you (its
  // `diff > 2` cliff), and dodge/crit also scale with the level gap — so a
  // target 3+ levels up is flagged as a steep step beyond a merely tough one.
  // Reads only the live target Entity.level versus your own (no new fields).
  private considerReadout(self: Entity): string {
    const t = self.targetId !== null ? this.entities.get(self.targetId) : undefined;
    if (!t) return 'You have no target to consider.';
    const diff = t.level - self.level;
    let verdict: string;
    if (diff >= 5) verdict = 'an overwhelming fight';
    else if (diff >= 3) verdict = 'a daunting fight';
    else if (diff >= 1) verdict = 'a tough fight';
    else if (diff === 0) verdict = 'an even fight';
    else if (diff >= -2) verdict = 'a manageable fight';
    else verdict = 'an easy fight';
    return `${t.name} is level ${t.level} — ${verdict} for you (level ${self.level}).`;
  }
  // Readout for "/pois": the named landmarks of your current zone, nearest
  // first, each with its distance in yards. Reads only the static ZoneDef.pois
  // (the same labels the HUD pins on the map) and your live position — no new
  // fields.
  private poisReadout(self: Entity): string {
    const zone = zoneAt(self.pos.z);
    if (zone.pois.length === 0) return `${zone.name} has no notable landmarks.`;
    const parts = zone.pois
      .map((p) => ({ label: p.label, d: dist2d(self.pos, { x: p.x, y: 0, z: p.z }) }))
      .sort((a, b) => a.d - b.d)
      .map((p) => `${p.label} (${Math.round(p.d)}yd)`);
    return `Landmarks in ${zone.name} (${parts.length}): ${parts.join(', ')}.`;
  }
  // Readout for "/completed": the quests you have turned in, in completion
  // order (questsDone is a Set whose insertion order is preserved on save/load).
  // Reads only PlayerMeta.questsDone + the QUESTS registry for names (no new
  // fields); distinct from /quest, which lists the active log.
  private completedReadout(meta: PlayerMeta): string {
    const names = [...meta.questsDone].map((id) => QUESTS[id]?.name ?? id);
    if (names.length === 0) return 'You have not completed any quests yet.';
    return `Completed quests (${names.length}): ${names.join(', ')}.`;
  }
  // Readout for "/listings": your own active World Market listings (house stock
  // and other sellers excluded), each with item, asking price, and time left
  // before it returns unsold. Reads only the live marketListings, ITEMS names,
  // and this.time (no new fields); the count is shown against MARKET_MAX_LISTINGS
  // so you know how much room you have left, mirroring the cap in marketList.
  private listingsReadout(meta: PlayerMeta): string {
    const mine = this.marketListings.filter((l) => this.marketListingBelongsTo(l, meta));
    if (mine.length === 0) return 'You have no goods on the World Market.';
    const parts = mine.map((l) => {
      const name = ITEMS[l.itemId]?.name ?? l.itemId;
      const qty = l.count > 1 ? ` x${l.count}` : '';
      const secs = Math.max(0, Math.ceil(l.expiresAt - this.time));
      const h = Math.floor(secs / 3600),
        m = Math.floor((secs % 3600) / 60);
      const left = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m` : `${secs}s`;
      return `${name}${qty} — ${formatMoney(l.price)} (${left} left)`;
    });
    return `Your market listings (${parts.length}/${MARKET_MAX_LISTINGS}): ${parts.join(', ')}.`;
  }
  // Self-only readout of the auras on the player's current target, each tagged
  // [buff] or [debuff]. Mirrors the self-aura readout but reaches across to the
  // target's live Entity.auras, so it works for mobs, pets, and other players.
  private targetBuffsReadout(self: Entity): string {
    const target = self.targetId !== null ? this.entities.get(self.targetId) : undefined;
    if (!target || target.hp <= 0) return 'You have no target.';
    const auras = target.auras;
    if (auras.length === 0) return `${target.name} has no active effects.`;
    const parts = auras.map((a) => {
      const stack = (a.stacks ?? 1) > 1 ? ` x${a.stacks}` : '';
      const tag = isHarmfulAura(a.kind) ? 'debuff' : 'buff';
      return `${a.name}${stack} [${tag}] (${Math.ceil(a.remaining)}s)`;
    });
    return `Effects on ${target.name} (${auras.length}): ${parts.join(', ')}.`;
  }
  // Self-only readout of current movement speed as a percent of normal run
  // speed. Effective speed is RUN_SPEED * moveSpeedMult(p), where the
  // multiplier folds slow/stealth auras against speed buffs; a root pins the
  // player regardless of the multiplier, so it is reported first.
  private speedReadout(e: Entity): string {
    if (isRooted(e)) return 'You are rooted in place and cannot move.';
    const mult = this.moveSpeedMult(e);
    const pct = Math.round(mult * 100);
    if (pct > 100) return `Movement speed: ${pct}% of normal (hastened).`;
    if (pct < 100) return `Movement speed: ${pct}% of normal (slowed).`;
    return 'Movement speed: 100% of normal.';
  }
  // Self-only readout for /attack: reads only live Entity auto-attack state
  // (autoAttack/swingTimer/targetId). The displayed swing interval reuses the
  // exact expression the engine resets the timer with (weapon.speed *
  // swingIntervalMult), so it reflects any active haste/slow auras.
  private attackReadout(p: Entity, meta: PlayerMeta): string {
    if (!p.autoAttack) return 'Auto-attack is off.';
    const t = p.targetId !== null ? this.entities.get(p.targetId) : null;
    if (!t || t.dead) return 'Auto-attack is on, but you have no valid target.';
    // ranged classes (hunter auto shot, caster wands) swing at their ranged
    // speed; everyone else uses the equipped weapon's speed
    const base = CLASSES[meta.cls].ranged?.speed ?? p.weapon.speed;
    const interval = base * this.swingIntervalMult(p);
    const next = p.swingTimer <= 0 ? 'now' : `in ${p.swingTimer.toFixed(1)}s`;
    return `Auto-attack is on against ${t.name} — next swing ${next} (${interval.toFixed(1)}s swing).`;
  }
  // Overpower is a warrior reactive: an enemy dodging the player's attack opens
  // a 5s window (overpowerUntil = time + 5) in which the ability becomes usable.
  // It is neither an aura nor a normal cooldown, so no other readout exposes it.
  private overpowerReadout(e: Entity, meta: PlayerMeta): string {
    if (meta.cls !== 'warrior') return 'Overpower is a warrior ability; your class cannot use it.';
    const remaining = Math.ceil(e.overpowerUntil - this.time);
    if (remaining > 0) {
      return `Overpower is ready — strike within ${remaining}s (an enemy dodged your attack).`;
    }
    return 'Overpower is not available. It opens for 5s after an enemy dodges your attack.';
  }
  // Reports the active shapeshift form or combat stance. Anchored to the
  // same toggle set the cast path treats as mutually-exclusive persistent
  // states (form_bear / form_cat / defensive_stance / stealth); realistically
  // only one is ever active, so the first match is the answer.
  private formReadout(e: Entity): string {
    const form = e.auras.find(
      (a) =>
        a.kind === 'form_bear' ||
        a.kind === 'form_cat' ||
        a.kind === 'form_travel' ||
        a.kind === 'defensive_stance' ||
        a.kind === 'stealth',
    );
    if (!form) return 'You are not in any form or stance.';
    if (form.kind === 'stealth') return 'You are stealthed.';
    return `You are in ${form.name}.`;
  }
  // Self-only readout of the five-second-rule mana state (#103 out-of-combat
  // regen). `fiveSecondRule` is the seconds elapsed since the player last spent
  // mana on an ability (reset to 0 at sim.ts cast path, bumped by DT each tick);
  // out-of-combat mana regen only ticks once it reaches FSR_THRESHOLD. Only
  // mana users have meaningful state here — rage/energy classes never spend mana.
  private manaRegenReadout(e: Entity): string {
    const FSR_THRESHOLD = 5; // matches the `fiveSecondRule >= 5` gate in updateRegen
    if (e.resourceType !== 'mana') {
      return 'Mana regeneration does not apply to your class.';
    }
    if (e.fiveSecondRule >= FSR_THRESHOLD) {
      return 'Your mana is regenerating (out of combat for 5s+).';
    }
    const resumesIn = Math.ceil(FSR_THRESHOLD - e.fiveSecondRule);
    return `Mana regen is paused — resumes in ${resumesIn}s (you spent mana recently).`;
  }
  // Self-only readout of vertical/fall state — surfaces the otherwise-invisible
  // jump physics (sim.ts updatePlayerMovement). Reads only live Entity fields and
  // the same groundHeight()/FALL_SAFE_DISTANCE the landing-damage model uses, so
  // the "this will hurt" preview matches what an actual landing would deal.
  private fallingReadout(e: Entity): string {
    const ground = groundHeight(e.pos.x, e.pos.z, this.cfg.seed);
    if (e.onGround) return 'You are on solid ground.';
    const height = Math.max(0, Math.round(e.pos.y - ground));
    if (e.vy > 0) return `You are airborne and rising — ${height}yd above the ground.`;
    const drop = e.fallStartY - ground;
    const danger =
      drop > FALL_SAFE_DISTANCE
        ? ' Brace for impact — this fall is going to hurt.'
        : ' It should be a safe landing.';
    return `You are falling — ${height}yd above the ground.${danger}`;
  }
  // Self-only readout of the controlled pet's Growl cooldown and autocast state.
  // Distinct from /pet (vitals) and /cooldowns (the player's own ability map,
  // which never holds this timer).
  private petTauntReadout(owner: Entity): string {
    const pet = this.petOf(owner.id);
    if (!pet) return 'You do not have a pet.';
    if (pet.petTauntTimer <= 0) {
      return pet.petAutoTaunt
        ? `Your pet's Growl is ready. Auto-taunt is on.`
        : `Your pet's Growl is ready. Auto-taunt is off.`;
    }
    const seconds = Math.ceil(pet.petTauntTimer);
    return pet.petAutoTaunt
      ? `Your pet's Growl is on cooldown. Auto-taunt is on. Ready in ${seconds}s.`
      : `Your pet's Growl is on cooldown. Auto-taunt is off. Ready in ${seconds}s.`;
  }
  // Druid forms park the mana bar in savedMana and run on rage/energy instead
  // (entity.ts:126-130). That parked pool has no in-game UI — the bar shows the
  // form's resource — so this readout is the only way to see what returns on
  // shift-out. Gates on the class's natural resource so non-casters get a clean
  // "never applies" rather than a misleading zero.
  private savedManaReadout(meta: PlayerMeta, e: Entity): string {
    if (CLASSES[meta.cls].resourceType !== 'mana') {
      return 'Only mana-using classes park mana; your class never does.';
    }
    if (e.resourceType === 'mana') {
      return 'Your mana is not parked — you are not shapeshifted.';
    }
    if (e.savedMana <= 0) {
      return 'You have no mana parked while shifted.';
    }
    return `You have ${Math.round(e.savedMana)} mana parked while shifted; it returns when you leave your form.`;
  }

  private error(pid: number, text: string, reason?: ErrorReason): void {
    this.emit(reason ? { type: 'error', text, pid, reason } : { type: 'error', text, pid });
  }

  // Lines shown by the "/help" command, one system notice per entry. Keep this
  // in sync with the commands handled in chat() above.
  private helpLines(): string[] {
    return [
      'Chat channels: /s say, /y yell, /general, /p party, /world, /lfg.',
      'Whisper a player with /w <name> <message>, reply with /r.',
      'Other commands: /join <world|lfg>, /roll, /inspect <name>, /follow <name>, /unfollow, /assist <name>, /afk, /dnd, /who.',
      'Character readouts: /played, /xp, /gold, /stats, /bags, /gear, /abilities, /buffs, /cooldowns, /quest, /completed.',
      'World readouts: /where, /zones, /nearby, /pois, /graveyard, /dungeons, /arena, /session, /listings, /buyback.',
      'Combat readouts: /target, /targetbuffs, /range, /attack, /casting, /combat, /threat, /consider, /combo, /overpower.',
      'State readouts: /pet, /pettaunt, /speed, /consumable, /potion, /form, /manaregen, /falling, /queued, /savedmana.',
    ];
  }

  // One-line readout for /inspect: another player's level, class, and health.
  private inspectReadout(target: PlayerMeta, e: Entity): string {
    const cls = CLASSES[target.cls]?.name ?? target.cls;
    const hp =
      e.hp <= 0 ? 'dead' : `${Math.round(Math.max(0, Math.min(1, e.hp / e.maxHp)) * 100)}%`;
    return `${target.name}: Level ${e.level} ${cls} — HP ${hp}.`;
  }

  // A positive, personal chat-log notice (e.g. confirming a /join). Unlike
  // error(), this lands in the chat log rather than flashing the error toast.
  private notice(pid: number, text: string, color = '#ffd100'): void {
    this.emit({ type: 'log', text, color, pid });
  }

  // Handles /join and /leave for the opt-in global channels.
  private handleChannelMembership(meta: PlayerMeta, action: 'join' | 'leave', arg: string): void {
    const pid = meta.entityId;
    if (!arg) {
      this.error(pid, `Usage: /${action} <channel>. Channels: ${JOINABLE_CHANNELS.join(', ')}.`);
      return;
    }
    if (arg === 'general') {
      this.error(pid, 'The General channel is always on - just use /general.');
      return;
    }
    if (!JOINABLE_CHANNELS.includes(arg as JoinableChannel)) {
      this.error(
        pid,
        `There is no channel named '${arg}'. Channels: ${JOINABLE_CHANNELS.join(', ')}.`,
      );
      return;
    }
    const channel = arg as JoinableChannel;
    let set = this.channelSubs.get(pid);
    if (action === 'join') {
      if (!set) {
        set = new Set();
        this.channelSubs.set(pid, set);
      }
      if (set.has(channel)) {
        this.error(pid, `You are already in the ${channel} channel.`);
        return;
      }
      set.add(channel);
      this.notice(pid, `Joined the ${channel} channel. Type /${channel} <message> to talk.`);
    } else {
      if (!set?.has(channel)) {
        this.error(pid, `You are not in the ${channel} channel.`);
        return;
      }
      set.delete(channel);
      if (set.size === 0) this.channelSubs.delete(pid);
      this.notice(pid, `Left the ${channel} channel.`);
    }
  }
  // One-line description of an entity for the self-only "/target" readout:
  // name, level, what it is (player / pet / mob), and current health. A dead
  // body reports "dead" instead of a percentage so a lootable corpse reads
  // sensibly.
  private targetReadout(t: Entity): string {
    const kind = t.kind === 'player' ? 'player' : t.ownerId !== null ? 'pet' : 'mob';
    const health = t.dead ? 'dead' : `${Math.round((t.hp / t.maxHp) * 100)}% HP`;
    return `Target: ${t.name} (level ${t.level} ${kind}) — ${health}.`;
  }
  // One-line leveling summary for the /xp readout. At MAX_LEVEL there is no
  // "next level" so we avoid the percent/remaining math (xpForLevel is 0 there).
  private xpReadout(meta: PlayerMeta, level: number): string {
    if (level >= MAX_LEVEL) return `Level ${MAX_LEVEL} — maximum level reached.`;
    const need = xpForLevel(level);
    const have = Math.max(0, Math.min(meta.xp, need));
    const pct = Math.floor((have / need) * 100);
    const fmt = (n: number) => n.toLocaleString('en-US');
    return `Level ${level} — ${fmt(have)}/${fmt(need)} XP (${pct}%), ${fmt(need - have)} to go.`;
  }
  // Render the /gold readout. An empty purse gets flavor text rather than the
  // bare "You have 0c." that formatMoney would otherwise produce.
  private goldReadout(copper: number): string {
    if (copper <= 0) return 'Your purse is empty.';
    return `You have ${formatMoney(copper)}.`;
  }
  // Self-only readout for "/buffs": summarise the auras currently on the
  // entity. Auras carry no buff/debuff flag, only an AuraKind and a `remaining`
  // time in seconds; toggles (stances, forms, stealth) use a 3600s sentinel
  // duration rather than Infinity, so a raw "(3600s)" reads poorly.
  private buffsReadout(e: Entity): string {
    if (e.auras.length === 0) return 'You have no active effects.';
    const parts = e.auras.map((a) => this.auraLabel(a));
    return `Active effects (${e.auras.length}): ${parts.join(', ')}.`;
  }

  // Render one aura for the /buffs list, e.g. "Rend (4s)". `remaining` is a
  // float, so Math.ceil keeps a still-active 0.3s remainder showing as "(1s)".
  private auraLabel(a: Aura): string {
    return `${a.name} (${Math.ceil(a.remaining)}s)`;
  }
  // Self-only readout for "/cooldowns": summarise the abilities currently on
  // cooldown for this entity, soonest-ready first.
  //
  // `e.cooldowns` is a Map<abilityId, remainingSeconds> — entries exist ONLY
  // while an ability is cooling down (updateTimers deletes them at <= 0), so an
  // empty map means everything is ready. Resolve the display name via
  // ABILITIES[id]?.name (fall back to the raw id if an ability is ever missing
  // from the table). `remaining` is a float, so Math.ceil keeps a 0.3s
  // remainder showing as "(1s)", matching how /buffs renders aura timers.
  //
  private cooldownsReadout(e: Entity): string {
    if (e.cooldowns.size === 0) return 'No abilities are on cooldown.';
    const parts = [...e.cooldowns]
      .sort((a, b) => a[1] - b[1])
      .map(([id, remaining]) => `${ABILITIES[id]?.name ?? id} (${Math.ceil(remaining)}s)`);
    return `Abilities on cooldown (${parts.length}): ${parts.join(', ')}.`;
  }
  // Self-only readout of the active quest log: one entry per tracked quest with
  // per-objective progress. questLog only ever holds 'active'/'ready' quests
  // (turn-in deletes the entry), so iterating it gives exactly what to show.
  private questReadout(meta: PlayerMeta): string {
    const lines: string[] = [];
    for (const [qid, qp] of meta.questLog) {
      const quest = QUESTS[qid];
      if (!quest) continue;
      const objs = quest.objectives
        .map((o, i) => `${o.label} ${Math.min(qp.counts[i] ?? 0, o.count)}/${o.count}`)
        .join(', ');
      const tag = qp.state === 'ready' ? ' (ready)' : '';
      lines.push(`${quest.name}${tag} — ${objs}`);
    }
    if (lines.length === 0) return 'Your quest log is empty.';
    return `Quest log (${lines.length}): ${lines.join(' | ')}.`;
  }
  // Self-only readout of equipped items, walked in a fixed slot order so the
  // line is stable and empty slots are visible (the point of a gear check).
  private gearReadout(meta: PlayerMeta): string {
    const slots: [EquipSlot, string][] = [
      ['mainhand', 'Main Hand'],
      ['helmet', 'Helmet'],
      ['shoulder', 'Shoulder'],
      ['chest', 'Chest'],
      ['waist', 'Waist'],
      ['legs', 'Legs'],
      ['gloves', 'Gloves'],
      ['feet', 'Feet'],
    ];
    let worn = 0;
    const parts = slots.map(([slot, label]) => {
      const itemId = meta.equipment[slot];
      if (!itemId) return `${label}: (empty)`;
      worn++;
      return `${label}: ${ITEMS[itemId]?.name ?? itemId}`;
    });
    if (worn === 0) return 'You have nothing equipped.';
    return `Equipped (${worn}/${slots.length}): ${parts.join(', ')}.`;
  }
  private abilitiesReadout(meta: PlayerMeta, e: Entity): string {
    const known = abilitiesKnownAt(meta.cls, e.level);
    if (known.length === 0) return 'You have not learned any abilities yet.';
    const list = known.map((k) => `${k.def.name} (Rank ${k.rank})`).join(', ');
    return `Spellbook (${known.length}): ${list}.`;
  }
  // Self-only readout of the player's active pet: name, level, beast family,
  // and current health. Reads live pet state via petOf() so it stays accurate
  // regardless of how the pet was acquired (tame, summon).
  private petReadout(owner: Entity): string {
    const pet = this.petOf(owner.id);
    if (!pet) return 'You do not have a pet.';
    const family = MOBS[pet.templateId]?.family;
    const kind = family ? ` ${family}` : '';
    const pct = pet.maxHp > 0 ? Math.round((pet.hp / pet.maxHp) * 100) : 0;
    return `Your pet: ${pet.name} (level ${pet.level}${kind}) — HP ${pet.hp}/${pet.maxHp} (${pct}%).`;
  }
  // Build the self-only "/session" line from this session's RewardCounters.
  // Counters are reset each boot (freshCounters), so this is always per-session.
  // Format kills/deaths first, then a damage clause, then XP — using
  // toLocaleString('en-US') for thousands separators on the large numbers.
  private sessionReadout(meta: PlayerMeta): string {
    const c = meta.counters;
    const n = (v: number) => v.toLocaleString('en-US');
    const plural = (v: number, word: string) => `${n(v)} ${word}${v === 1 ? '' : 's'}`;
    return (
      `Session: ${plural(c.kills, 'kill')}, ${plural(c.deaths, 'death')}. ` +
      `Damage dealt ${n(c.damageDealt)}, taken ${n(c.damageTaken)}. ` +
      `XP gained ${n(c.xpGained)}.`
    );
  }
  /** Self-only readout of the threat table on the player's current target,
   *  highest first, as a percentage of the current threat leader. */
  private threatReadout(self: Entity): string {
    const t = self.targetId !== null ? this.entities.get(self.targetId) : undefined;
    if (!t || t.hp <= 0) return 'You have no target.';
    if (t.kind !== 'mob') return `Threat is only tracked on enemies; ${t.name} is not one.`;
    const entries = threatEntries(t, 10);
    if (entries.length === 0) return `Nobody has any threat on ${t.name}.`;
    const top = entries[0][1] || 1;
    const parts = entries.map(([id, v], i) => {
      const pct = Math.round((v / top) * 100);
      const you = id === self.id ? ' (you)' : '';
      const lead = i === 0 ? ' [leader]' : '';
      return `${this.threatName(id)}${you} ${pct}%${lead}`;
    });
    return `Threat on ${t.name} (${entries.length}): ${parts.join(', ')}.`;
  }

  /** Display name for a threat-table source: a player by pid, else the entity
   *  (pet/mob) name, else a placeholder for sources that have despawned. */
  private threatName(id: number): string {
    const meta = this.players.get(id);
    if (meta) return meta.name;
    return this.entities.get(id)?.name || 'Unknown';
  }
  // One scannable entry per nearby entity: name, what it is, and how far.
  // Pets are mobs with a non-null ownerId; players have no level prefix.
  private nearbyLabel(e: Entity, d: number): string {
    const yd = `${Math.round(d)}yd`;
    if (e.kind === 'player') return `${e.name} (player, ${yd})`;
    const kind = e.kind === 'mob' && e.ownerId !== null ? 'pet' : e.kind;
    return `${e.name} (Lvl ${e.level} ${kind}, ${yd})`;
  }

  // Self-only readout of living entities within NEARBY_RANGE of `self`,
  // nearest first. Reads only live Entity state (pos/kind/level/hp), so it
  // never desyncs and adds no persisted fields.
  private nearbyReadout(self: Entity): string {
    const found: { e: Entity; d: number }[] = [];
    for (const e of this.entities.values()) {
      if (e.id === self.id || e.kind === 'object' || e.hp <= 0) continue;
      const d = dist2d(self.pos, e.pos);
      if (d <= NEARBY_RANGE) found.push({ e, d });
    }
    if (found.length === 0) return 'Nothing is nearby.';
    found.sort((a, b) => a.d - b.d);
    const shown = found.slice(0, NEARBY_MAX);
    const labels = shown.map(({ e, d }) => this.nearbyLabel(e, d));
    const more = found.length - shown.length;
    if (more > 0) labels.push(`(+${more} more)`);
    return `Nearby (${found.length}): ${labels.join(', ')}.`;
  }
  // Distance from the player to their current target. Reads only live Entity
  // state (targetId + positions), so it needs no new fields and works online
  // for free. The in-melee hint compares the RAW distance to MELEE_RANGE — the
  // same threshold the swing-resolution code uses — while the displayed yards
  // are rounded, so the hint stays truthful even when rounding lands on 5yd.
  private rangeReadout(self: Entity): string {
    if (self.targetId === null) return 'You have no target.';
    const t = this.entities.get(self.targetId);
    if (!t) return 'You have no target.';
    const d = dist2d(self.pos, t.pos);
    const reach = d <= MELEE_RANGE ? 'in melee range' : 'out of melee range';
    return `Your target ${t.name} is ${Math.round(d)}yd away (${reach}).`;
  }
  // Reads the live cast-bar state (no stored fields): castingAbility holds an
  // ability id or the FISHING_CAST_ID sentinel, channeling distinguishes a
  // channel from a normal cast. Times are fractional seconds, so toFixed(1)
  // stays truthful rather than rounding a 2.5s cast to "3s".
  private castingReadout(e: Entity): string {
    if (!e.castingAbility) return 'You are not casting anything.';
    const remaining = e.castRemaining.toFixed(1);
    const total = e.castTotal.toFixed(1);
    if (e.castingAbility === FISHING_CAST_ID) {
      return `You are fishing — ${remaining}s of ${total}s remaining.`;
    }
    const name = ABILITIES[e.castingAbility]?.name ?? e.castingAbility;
    const verb = e.channeling ? 'Channeling' : 'Casting';
    return `${verb} ${name} — ${remaining}s of ${total}s remaining.`;
  }
  // Self-only readout of what the player is currently eating/drinking. Food and
  // drink occupy separate slots and tick concurrently, each on its own remaining
  // timer, so both are reported with their own restore rate and time left.
  private consumableReadout(e: Entity): string {
    const parts: string[] = [];
    for (const c of [e.eating, e.drinking]) {
      if (!c) continue;
      const name = ITEMS[c.itemId]?.name ?? c.itemId;
      const restores: string[] = [];
      if (c.hpPer2s > 0) restores.push(`+${c.hpPer2s} HP/2s`);
      if (c.manaPer2s > 0) restores.push(`+${c.manaPer2s} mana/2s`);
      restores.push(`${Math.ceil(c.remaining)}s left`);
      const verb = c.kind === 'food' ? 'eating' : 'drinking';
      parts.push(`${verb} ${name} (${restores.join(', ')})`);
    }
    if (parts.length === 0) return 'You are not eating or drinking.';
    return `You are ${parts.join(' and ')}.`;
  }
  // Self-only readout of the shared combat-potion cooldown (#103). Distinct from
  // /cooldowns, which reads the per-ability Entity.cooldowns map and never shows
  // this separate 60s potion timer. potionCooldownUntil is an absolute sim-time
  // deadline, so the remaining time is computed against this.time.
  private potionReadout(e: Entity): string {
    const remaining = e.potionCooldownUntil - this.time;
    if (remaining <= 0) return 'Combat potion is ready to use.';
    return `Combat potion on cooldown — ready in ${Math.ceil(remaining)}s.`;
  }
  // Self-only readout of the ability armed to fire on the next melee swing
  // (Heroic Strike / Raptor Strike / Maul). Distinct from /casting (active
  // cast bar) and /cooldowns (recharge timers): an on-swing ability is neither
  // casting nor on cooldown, just waiting for the swing — and it silently
  // fizzles if the resource can't be paid when the swing lands (see swing
  // resolution), so the readout flags that case up front.
  private queuedReadout(e: Entity): string {
    if (!e.queuedOnSwing) return 'You have no ability queued for your next swing.';
    const queued = this.resolvedAbility(e.queuedOnSwing, e.id);
    const name = queued?.def.name ?? e.queuedOnSwing;
    if (!queued) return `${name} is queued for your next melee swing.`;
    const res = e.resourceType ?? 'resource';
    const have = Math.floor(e.resource);
    if (e.resource >= queued.cost) {
      return `${name} is queued for your next melee swing (costs ${queued.cost} ${res}; you have ${have}).`;
    }
    return `${name} is queued for your next melee swing, but you cannot afford it (costs ${queued.cost} ${res}; you have ${have}) — it will fizzle.`;
  }

  // Self-only readout for "/talents": the player's specialization and how their
  // talent points are split across the Class tree and the chosen spec tree.
  // Points are derived live from level (talentPointsAtLevel), so the total stays
  // correct after a level-up even if the allocation hasn't been touched since.
  private talentsReadout(meta: PlayerMeta, e: Entity): string {
    const ct = talentsFor(meta.cls);
    if (!ct) return 'Your class has no talent tree yet.';
    const total = talentPointsAtLevel(e.level);
    if (total <= 0)
      return `You have not unlocked talents yet — they begin at level ${FIRST_TALENT_LEVEL}.`;
    const spent = pointsSpent(meta.talents);
    // Split spent points by tree (cold path: walk the allocation once on demand).
    const byId = new Map(ct.nodes.map((n) => [n.id, n] as const));
    let classPts = 0;
    let specPts = 0;
    for (const id in meta.talents.ranks) {
      const node = byId.get(id);
      if (!node) continue;
      if (node.tree === 'class') classPts += meta.talents.ranks[id];
      else specPts += meta.talents.ranks[id];
    }
    const specName = meta.talents.spec
      ? (ct.specs.find((s) => s.id === meta.talents.spec)?.name ?? meta.talents.spec)
      : null;
    const head = specName ?? 'no specialization';
    const breakdown = specName ? `Class ${classPts}, ${specName} ${specPts}` : `Class ${classPts}`;
    const unspent = total - spent;
    const tail = unspent > 0 ? ` ${unspent} unspent.` : '';
    return `Talents: ${head} — ${spent}/${total} points spent (${breakdown}).${tail}`;
  }
  // -------------------------------------------------------------------------
  // Delves, replayable modular instances (see docs/prd/delves.md)
  // -------------------------------------------------------------------------

  // Delve run lifecycle (I2a) lives in src/sim/delves/runs.ts; Sim keeps same-named
  // thin delegates so the IWorld surface, the shared reach-in entry points, the
  // interleaved I2b/I2c callers, the movement clamps, and the (sim as any) test casts
  // all resolve unchanged. The bodies moved verbatim behind SimContext.
  private delveOriginOf(run: DelveRun): { x: number; z: number } {
    return runsMod.delveOriginOf(run);
  }

  private delveModuleZOffset(run: DelveRun, moduleIndex = run.moduleIndex): number {
    return runsMod.delveModuleZOffset(run, moduleIndex);
  }

  private delveOccupancyRadius(run: DelveRun): number {
    return runsMod.delveOccupancyRadius(run);
  }

  private delveRunForEntity(e: Entity): DelveRun | null {
    return runsMod.delveRunForEntity(this.ctx, e);
  }

  // Swept move resolution for players, keeps v0.10.0's segment-based
  // resolveMovement (no tunnelling through thin walls) and layers the delve
  // module colliders + portcullis doors on top when inside a delve.
  private resolveMove(
    fromX: number,
    fromZ: number,
    nx: number,
    nz: number,
    r: number,
    e: Entity,
    ignoreFences = false,
  ): { x: number; z: number } {
    const run = isDelvePos(nx) || isDelvePos(e.pos.x) ? this.delveRunForEntity(e) : undefined;
    const res = resolveMovement(this.cfg.seed, fromX, fromZ, nx, nz, r, ignoreFences, run?.modules);
    if (!run) return res;
    const clamped = this.clampDelveModuleBounds(run, res.x, res.z, r);
    return this.clampDelveDoors(run, clamped.x, clamped.z, r);
  }

  // Point resolution for mob wander / blocked checks, with the same delve layering.
  private resolveMovePoint(nx: number, nz: number, r: number, e: Entity): { x: number; z: number } {
    const run = isDelvePos(nx) || isDelvePos(e.pos.x) ? this.delveRunForEntity(e) : undefined;
    const res = resolvePosition(this.cfg.seed, nx, nz, r, false, run?.modules);
    if (!run) return res;
    const clamped = this.clampDelveModuleBounds(run, res.x, res.z, r);
    return this.clampDelveDoors(run, clamped.x, clamped.z, r);
  }

  private clampDelveModuleBounds(
    run: DelveRun,
    x: number,
    z: number,
    r: number,
  ): { x: number; z: number } {
    return runsMod.clampDelveModuleBounds(run, x, z, r);
  }

  private clampDelveDoors(
    run: DelveRun,
    x: number,
    z: number,
    r: number,
  ): { x: number; z: number } {
    return runsMod.clampDelveDoors(this.ctx, run, x, z, r);
  }

  delveModuleEntry(run: DelveRun): Vec3 {
    return runsMod.delveModuleEntry(this.ctx, run);
  }

  delveRunForPlayer(pid: number): DelveRun | null {
    return runsMod.delveRunForPlayer(this.ctx, pid);
  }

  private delveRunForMob(mobId: number): DelveRun | null {
    return runsMod.delveRunForMob(this.ctx, mobId);
  }

  private partyMembersForKey(key: string): number[] {
    const out: number[] = [];
    for (const meta of this.players.values()) {
      if (this.instanceKeyFor(meta.entityId) === key) out.push(meta.entityId);
    }
    return out;
  }

  private refreshDelveDaily(meta: PlayerMeta): void {
    runsMod.refreshDelveDaily(this.ctx, meta);
  }

  private pickDelveModules(delve: DelveDef, seed: number, tierId: string): string[] {
    return runsMod.pickDelveModules(delve, seed, tierId);
  }

  private stowPetForDelve(pid: number): void {
    runsMod.stowPetForDelve(this.ctx, pid);
  }

  private restorePetFromDelveStash(pid: number): void {
    runsMod.restorePetFromDelveStash(this.ctx, pid);
  }

  private canEnterDelve(pid: number): string | null {
    return runsMod.canEnterDelve(this.ctx, pid);
  }

  enterDelve(delveId: string, tierId: string, pid?: number): void {
    runsMod.enterDelve(this.ctx, delveId, tierId, pid);
  }

  leaveDelve(pid?: number): void {
    runsMod.leaveDelve(this.ctx, pid);
  }

  private claimDelveRun(run: DelveRun, key: string, delveId: string, tierId: string): void {
    runsMod.claimDelveRun(this.ctx, run, key, delveId, tierId);
  }

  private spawnDelveModule(run: DelveRun): void {
    runsMod.spawnDelveModule(this.ctx, run);
  }

  private freeDelveRun(run: DelveRun): void {
    runsMod.freeDelveRun(this.ctx, run);
  }

  private updateDelveRuns(): void {
    runsMod.updateDelveRuns(this.ctx);
  }

  private ejectToDelveDoor(pid: number, delve: DelveDef): void {
    runsMod.ejectToDelveDoor(this.ctx, pid, delve);
  }

  private failDelveRun(run: DelveRun): void {
    runsMod.failDelveRun(this.ctx, run);
  }

  private onDelveBossDefeated(run: DelveRun): void {
    runsMod.onDelveBossDefeated(this.ctx, run);
  }

  private delveMarkPayout(run: DelveRun, meta: PlayerMeta): number {
    return runsMod.delveMarkPayout(this.ctx, run, meta);
  }

  private unlockNextDelveLore(meta: PlayerMeta, pid: number): void {
    runsMod.unlockNextDelveLore(this.ctx, meta, pid);
  }

  private grantDelveClearTo(run: DelveRun, delve: DelveDef, meta: PlayerMeta, pid: number): void {
    runsMod.grantDelveClearTo(this.ctx, run, delve, meta, pid);
  }

  private grantDelveRewards(run: DelveRun): void {
    runsMod.grantDelveRewards(this.ctx, run);
  }

  private openDelveSurfaceExit(run: DelveRun): void {
    runsMod.openDelveSurfaceExit(this.ctx, run);
  }

  // In-delve respawn lives in entity_roster.ts (E1, merged E2). Thin delegate keeps
  // the public method resolving unchanged.
  releaseSpiritInDelve(pid: number): void {
    releaseSpiritInDelveImpl(this.ctx, pid);
  }

  private pickDelveSpawnSet(mod: DelveModuleDef, seed: number, moduleIndex: number) {
    return runsMod.pickDelveSpawnSet(mod, seed, moduleIndex);
  }

  private spawnDelveInteractables(run: DelveRun, mod: DelveModuleDef, zBase: number): void {
    runsMod.spawnDelveInteractables(this.ctx, run, mod, zBase);
  }

  private createDelveObject(run: DelveRun, kind: string, pos: Vec3): Entity {
    return runsMod.createDelveObject(this.ctx, run, kind, pos);
  }

  private tickDelveRun(run: DelveRun): void {
    runsMod.tickDelveRun(this.ctx, run);
  }

  private emitDelveModuleEnter(run: DelveRun, mod: DelveModuleDef): void {
    runsMod.emitDelveModuleEnter(this.ctx, run, mod);
  }

  private spawnDelveModuleExit(run: DelveRun, mod: DelveModuleDef, zBase: number): void {
    runsMod.spawnDelveModuleExit(this.ctx, run, mod, zBase);
  }

  private findDelveExitPortal(run: DelveRun): Entity | null {
    return runsMod.findDelveExitPortal(this.ctx, run);
  }

  private tryOpenDelveExitPortal(run: DelveRun): void {
    runsMod.tryOpenDelveExitPortal(this.ctx, run);
  }

  private openDelveExitPortal(run: DelveRun): void {
    runsMod.openDelveExitPortal(this.ctx, run);
  }

  private advanceDelveModule(run: DelveRun): void {
    runsMod.advanceDelveModule(this.ctx, run);
  }

  private tickDelveModuleExit(run: DelveRun): void {
    runsMod.tickDelveModuleExit(this.ctx, run);
  }

  private tickDelvePressurePlates(run: DelveRun): void {
    runsMod.tickDelvePressurePlates(this.ctx, run);
  }

  private tickDelveRaiseDeadChannel(run: DelveRun): void {
    runsMod.tickDelveRaiseDeadChannel(this.ctx, run);
  }

  private tickDelveBadAir(run: DelveRun): void {
    runsMod.tickDelveBadAir(this.ctx, run);
  }

  private tickDelveRestlessGraves(run: DelveRun): void {
    runsMod.tickDelveRestlessGraves(this.ctx, run);
  }

  private rollDelveAffixes(delve: DelveDef, tierId: string, seed: number): string[] {
    return runsMod.rollDelveAffixes(delve, tierId, seed);
  }

  private delveDetectMult(player: Entity): number {
    return runsMod.delveDetectMult(this.ctx, player);
  }

  private findDelveObject(run: DelveRun, kind: string): Entity | null {
    return runsMod.findDelveObject(this.ctx, run, kind);
  }

  private startDelveRaiseDeadChannel(
    run: DelveRun,
    boss: Entity,
    mobId: string,
    count: number,
  ): boolean {
    return runsMod.startDelveRaiseDeadChannel(this.ctx, run, boss, mobId, count);
  }

  private isDelveCompanionMob(mob: Entity): boolean {
    return (
      mob.ownerId !== null &&
      Object.values(DELVE_COMPANIONS).some((c) => c.mobTemplateId === mob.templateId)
    );
  }

  private spawnDelveCompanion(run: DelveRun, pid: number, companionId: string): void {
    const def = DELVE_COMPANIONS[companionId];
    const owner = this.entities.get(pid);
    const template = def ? MOBS[def.mobTemplateId] : null;
    if (!def || !owner || !template || run.companion) return;
    // Tessa's combat level scales with her purchased rank (rank 1 = 50% of owner
    // level, up to 100% at rank 3), so Marks investment, not just being present,
    // is what makes her a peer. Floored at 1 so a low-level owner never yields 0.
    const rank = this.players.get(pid)?.companionUpgrades[companionId] ?? 1;
    const levelPct = DELVE_COMPANION_LEVEL_PCT[rank] ?? DELVE_COMPANION_LEVEL_PCT[1];
    const companionLevel = Math.max(1, Math.round(owner.level * levelPct));
    const mob = createMob(
      this.nextId++,
      template,
      companionLevel,
      this.groundPos(owner.pos.x + 1.5, owner.pos.z),
    );
    mob.ownerId = pid;
    mob.hostile = false;
    mob.aiState = 'idle';
    mob.wanderTimer = DELVE_COMPANION_HEAL_INTERVAL;
    this.addEntity(mob);
    run.companion = { companionId, entityId: mob.id };
  }

  private despawnDelveCompanion(run: DelveRun): void {
    if (!run.companion) return;
    if (this.entities.has(run.companion.entityId)) this.dropEntity(run.companion.entityId);
    run.companion = undefined;
  }

  private maybeCompanionBark(run: DelveRun, pid: number, barkId: string): void {
    if (!run.companion || run.companionBarks.includes(barkId)) return;
    run.companionBarks.push(barkId);
    this.emit({ type: 'companionBark', barkId, pid });
  }

  private updateDelveCompanion(companion: Entity): void {
    const owner = companion.ownerId !== null ? this.entities.get(companion.ownerId) : null;
    if (owner?.kind !== 'player' || owner.dead) {
      this.dropEntity(companion.id);
      return;
    }
    const run = this.delveRunForPlayer(owner.id);
    if (!run?.companion || run.companion.entityId !== companion.id) {
      this.dropEntity(companion.id);
      return;
    }
    if (owner.inCombat) this.maybeCompanionBark(run, owner.id, 'combat_start');
    if (owner.hp / Math.max(1, owner.maxHp) < 0.3) this.maybeCompanionBark(run, owner.id, 'low_hp');

    companion.swingTimer = (companion.swingTimer ?? 0) - DT;
    let combatTarget: Entity | null = null;
    if (owner.targetId !== null) {
      const t = this.entities.get(owner.targetId);
      if (t && !t.dead && this.isHostileTo(companion, t)) combatTarget = t;
    }
    if (!combatTarget) {
      let best: Entity | null = null;
      let bestD = 40;
      for (const m of this.entities.values()) {
        if (m.kind !== 'mob' || m.dead || !this.isHostileTo(companion, m)) continue;
        const engagingOwner = m.aggroTargetId === owner.id;
        const ownerOffense =
          owner.targetId === m.id && (owner.autoAttack || owner.inCombat || m.threat.has(owner.id));
        if (!engagingOwner && !ownerOffense) continue;
        const d = dist2d(companion.pos, m.pos);
        if (d < bestD) {
          best = m;
          bestD = d;
        }
      }
      combatTarget = best;
    }
    if (combatTarget) {
      companion.inCombat = true;
      const reach = MELEE_RANGE * 0.9;
      const cd = dist2d(companion.pos, combatTarget.pos);
      if (cd > reach) {
        companion.swingTimer = Math.max(0, (companion.swingTimer ?? 0) - DT);
        if (!isRooted(companion)) {
          this.moveToward(
            companion,
            combatTarget.pos,
            companion.moveSpeed * this.moveSpeedMult(companion),
          );
        }
      } else {
        companion.facing = angleTo(companion.pos, combatTarget.pos);
        companion.swingTimer = (companion.swingTimer ?? 0) - DT;
        if (companion.swingTimer <= 0) {
          this.mobSwing(companion, combatTarget);
          companion.swingTimer = companion.weapon.speed * this.swingIntervalMult(companion);
        }
      }
    } else {
      companion.inCombat = false;
      companion.swingTimer = Math.max(0, (companion.swingTimer ?? 0) - DT);
    }

    companion.wanderTimer = (companion.wanderTimer ?? 0) - DT;
    if (companion.wanderTimer <= 0) {
      companion.wanderTimer = DELVE_COMPANION_HEAL_INTERVAL;
      const rank = this.players.get(owner.id)?.companionUpgrades[run.companion.companionId] ?? 1;
      let target: Entity = owner;
      let lowest = owner.hp / owner.maxHp;
      if (run.partyKey) {
        for (const pid of this.partyMembersForKey(run.partyKey)) {
          const ally = this.entities.get(pid);
          if (!ally || ally.dead) continue;
          const frac = ally.hp / ally.maxHp;
          if (frac < lowest && dist2d(companion.pos, ally.pos) <= DELVE_COMPANION_HEAL_RANGE) {
            lowest = frac;
            target = ally;
          }
        }
      }
      if (
        target.hp < target.maxHp &&
        dist2d(companion.pos, target.pos) <= DELVE_COMPANION_HEAL_RANGE
      ) {
        const pct =
          DELVE_COMPANION_HEAL_PCT[Math.min(rank, DELVE_COMPANION_MAX_RANK)] ??
          DELVE_COMPANION_HEAL_PCT[1];
        const healed = Math.min(target.maxHp - target.hp, Math.round(target.maxHp * pct));
        target.hp += healed;
        this.emit({ type: 'heal', targetId: target.id, amount: healed });
        this.emit({
          type: 'spellfx',
          sourceId: companion.id,
          targetId: target.id,
          school: 'holy',
          fx: 'tick',
        });
      }
    }
    if (combatTarget) return;
    const d = dist2d(companion.pos, owner.pos);
    if (d > PET_TELEPORT_DISTANCE) {
      companion.pos = { ...owner.pos };
      companion.prevPos = { ...companion.pos };
      this.rebucket(companion);
    } else if (d > DELVE_COMPANION_FOLLOW && !isRooted(companion)) {
      this.moveToward(companion, owner.pos, companion.moveSpeed * this.moveSpeedMult(companion));
    }
  }

  delveInteract(objectId: number, pid?: number): void {
    runsMod.delveInteract(this.ctx, objectId, pid);
  }

  // -------------------------------------------------------------------------
  // Lockpicking minigame ("Tumbler's Path"), server-authoritative. The client
  // submits one action enum per step; the sim owns the lock, validates every
  // step, and grants loot only on a server-side SUCCESS. The full lock layout is
  // never serialized, only visibleCells() inside the fog window is emitted.
  // -------------------------------------------------------------------------

  /** Resolve the locked-chest object + run for an acting player, with all the
   * proximity/eligibility guards. Returns null (after emitting an error) on any
   * failure. */
  private resolveLockChest(
    objectId: number,
    pid?: number,
  ): {
    r: { e: Entity; meta: PlayerMeta };
    run: DelveRun;
    state: DelveObjectState;
    obj: Entity;
  } | null {
    const r = this.resolve(pid);
    if (!r) return null;
    let run = this.delveRunForPlayer(r.meta.entityId);
    if (!run)
      run =
        this.delveRuns.find((d) => d.partyKey !== null && d.objectIds.includes(objectId)) ?? null;
    if (!run) {
      this.error(r.meta.entityId, 'You are not in a delve.');
      return null;
    }
    const state = run.objectState[objectId];
    const obj = this.entities.get(objectId);
    if (!state || !obj || state.kind !== 'locked_chest') {
      this.error(r.meta.entityId, 'You cannot pick that.');
      return null;
    }
    if (dist2d(r.e.pos, obj.pos) > DELVE_PLATE_RADIUS + 2) {
      this.error(r.meta.entityId, 'Move closer to the chest.');
      return null;
    }
    return { r, run, state, obj };
  }

  /** Start a lockpicking attempt: commit an ante (1/2/3 lives = loot tier). */
  lockpickEngage(objectId: number, ante: Ante, pid?: number): void {
    const got = this.resolveLockChest(objectId, pid);
    if (!got) return;
    const { r, run, state } = got;
    if (ante !== 1 && ante !== 2 && ante !== 3) {
      this.error(r.meta.entityId, 'Choose 1, 2, or 3 picks.');
      return;
    }
    if (state.looted) {
      this.emit({ type: 'log', text: 'The chest is empty.', color: '#aaa', pid: r.meta.entityId });
      return;
    }
    if (!state.attemptAvailable) {
      this.error(
        r.meta.entityId,
        'The lock is jammed beyond picking. Clear the delve again for another attempt.',
      );
      return;
    }
    if (run.lockpick && run.lockpick.state === 'IN_PROGRESS') {
      this.error(r.meta.entityId, 'Someone is already working the lock.');
      return;
    }

    // §7.6 Bountiful Coffer: a purple coffer only yields to a Hard-tier (heroic
    // preset) + Premium-ante (1) solve. Server-authoritative, rejected here no
    // matter what ante the UI offered; the lower antes are not an option.
    const isCoffer = run.bountiful && objectId === run.rewardChestId;
    if (isCoffer && ante !== 1) {
      this.error(
        r.meta.entityId,
        "This seal yields only to a master's hand. Only the Premium ante can open it.",
      );
      return;
    }

    const tier = lockpickPresetFor(isCoffer ? 'heroic' : run.tierId);
    const baseSeed = (run.seed ^ (objectId * 0x9e3779b1)) >>> 0;
    const triesTotal = ANTE_TO_TRIES[ante];
    const pages = generateLockPages(baseSeed, tier, ANTE_TO_PAGES[ante]);
    const spec = pages[0];
    const session: LockSession = {
      // Unique per engage (tickCount is the deterministic sim clock) so the
      // staleness guard rejects actions from a prior, re-engaged attempt.
      sessionId: `lp_${objectId}_${this.tickCount}`,
      chestId: objectId,
      ownerId: r.meta.entityId,
      baseSeed,
      pages,
      pageIndex: 0,
      ante,
      lootTier: ANTE_TO_TIER[ante],
      col: 0,
      row: spec.startRow,
      triesLeft: triesTotal,
      triesTotal,
      stepDeadlineTick: 0, // set by armLockpickStep below
      state: 'IN_PROGRESS',
    };
    run.lockpick = session;
    this.armLockpickStep(session);
    this.emit({
      type: 'lockpickSession',
      sessionId: session.sessionId,
      objectId,
      w: spec.tier.cols,
      h: spec.tier.rows,
      col: session.col,
      row: session.row,
      page: 1,
      pageCount: pages.length,
      tries: session.triesLeft,
      triesTotal: session.triesTotal,
      lootTier: session.lootTier,
      allowed: spec.tier.allowedActions,
      visible: visibleCells(spec, session.col, spec.tier.visibilityWindow),
      stepTimeoutMs: ANTE_TO_STEP_TIMEOUT_MS[ante],
      pid: r.meta.entityId,
    });
  }

  /** (Re)start the per-step clock for the active page. The deadline is in sim
   * ticks (deterministic), so the timeout is reproducible from the input timing
   * alone and identical offline, on the server, and headless. The budget is the
   * ante's ANTE_TO_STEP_TIMEOUT_MS (hard 3s / medium 6s / easy 9s per move). */
  private armLockpickStep(session: LockSession): void {
    const ms = ANTE_TO_STEP_TIMEOUT_MS[session.ante];
    session.stepDeadlineTick = this.tickCount + Math.ceil(ms / (DT * 1000));
  }

  /** Server-authoritative per-step clock, run every tick for every run (so a solo
   * offline run, an online run, and a headless run all enforce it identically).
   * When the active step's deadline passes it counts as a failed try; the client
   * never reports a timeout. */
  private tickLockpickTimeout(run: DelveRun): void {
    const s = run.lockpick;
    if (s?.state !== 'IN_PROGRESS') return;
    if (this.tickCount >= s.stepDeadlineTick) this.lockpickStepTimeout(run, s);
  }

  /** A step's clock expired: burn a try (board reset on retry, chest jams when
   * tries run out), mirroring a slip. lockpickBurnTry re-arms the clock on retry. */
  private lockpickStepTimeout(run: DelveRun, session: LockSession): void {
    const result = this.lockpickBurnTry(session);
    const spec = session.pages[session.pageIndex];
    this.emit({
      type: 'lockpickStep',
      sessionId: session.sessionId,
      col: session.col,
      row: session.row,
      page: session.pageIndex + 1,
      pageCount: session.pages.length,
      tries: session.triesLeft,
      triesTotal: session.triesTotal,
      result,
      visible: visibleCells(spec, session.col, spec.tier.visibilityWindow),
      pid: session.ownerId,
    });
    if (result === 'fail') this.lockpickFail(run, session);
  }

  /** Submit one pick action on the player's active attempt. Abort ends it
   * (preserving the chest). `sessionId`, when supplied (server path), is checked
   * for staleness; offline play omits it and acts on the one live session. */
  lockpickAction(action: PickAction, pid?: number, sessionId?: string): void {
    const r = this.resolve(pid);
    if (!r) return;
    const run = this.delveRunForPlayer(r.meta.entityId);
    const session = run?.lockpick ?? null;
    if (!run || !session) {
      this.error(r.meta.entityId, 'No lock attempt in progress.');
      return;
    }
    if (sessionId !== undefined && session.sessionId !== sessionId) {
      this.error(r.meta.entityId, 'No lock attempt in progress.');
      return;
    }
    if (session.ownerId !== r.meta.entityId) {
      this.error(r.meta.entityId, 'That is not your lock.');
      return;
    }
    if (session.state !== 'IN_PROGRESS') return;

    if (action === 'abort') {
      this.lockpickAbort(r.meta.entityId, session.sessionId);
      return;
    }
    let spec = session.pages[session.pageIndex];
    if (!spec.tier.allowedActions.includes(action)) {
      this.error(r.meta.entityId, 'That tool slips off this lock.');
      return;
    }

    const step = stepLock(spec, session.col, session.row, action);
    let result = step.result;
    if (result === 'slip' || result === 'bind' || result === 'trap') {
      // The try failed. Burn one try; if any remain, reset to a fresh board so
      // the player can try again. Only when tries run out does the chest jam.
      result = this.lockpickBurnTry(session);
      spec = session.pages[session.pageIndex];
    } else {
      session.col = step.col;
      session.row = step.row;
      if (result === 'success' && session.pageIndex < session.pages.length - 1) {
        // Page seated but more remain, roll onto the next lock board.
        session.pageIndex += 1;
        spec = session.pages[session.pageIndex];
        session.col = 0;
        session.row = spec.startRow;
        result = 'pageCleared';
      }
      // A correct move re-arms the per-step clock (a terminal success ends the
      // session right after, so the fresh deadline is simply never reached).
      this.armLockpickStep(session);
    }

    this.emit({
      type: 'lockpickStep',
      sessionId: session.sessionId,
      col: session.col,
      row: session.row,
      page: session.pageIndex + 1,
      pageCount: session.pages.length,
      tries: session.triesLeft,
      triesTotal: session.triesTotal,
      result,
      visible: visibleCells(spec, session.col, spec.tier.visibilityWindow),
      pid: r.meta.entityId,
    });

    if (result === 'success') {
      this.lockpickSucceed(run, session);
    } else if (result === 'fail') {
      this.lockpickFail(run, session);
    }
  }

  /** A try failed (slip/bind/trap or timeout). Consume one try; if any remain,
   * regenerate a fresh page set and reset to the start, returning 'retry'.
   * Otherwise return 'fail' (caller jams the chest). */
  private lockpickBurnTry(session: LockSession): 'retry' | 'fail' {
    session.triesLeft -= 1;
    if (session.triesLeft <= 0) return 'fail';
    // Fresh boards each try so a failed run can't simply be memorized.
    const triesUsed = session.triesTotal - session.triesLeft;
    const seed = (session.baseSeed ^ (triesUsed * 0x85ebca6b)) >>> 0;
    session.pages = generateLockPages(seed, session.pages[0].tier, session.pages.length);
    session.pageIndex = 0;
    session.col = 0;
    session.row = session.pages[0].startRow;
    this.armLockpickStep(session); // fresh board, fresh per-step clock
    return 'retry';
  }

  lockpickAbort(pid?: number, sessionId?: string): void {
    const r = this.resolve(pid);
    if (!r) return;
    const run = this.delveRunForPlayer(r.meta.entityId);
    const session = run?.lockpick ?? null;
    if (!run || !session || session.ownerId !== r.meta.entityId) return;
    if (sessionId !== undefined && session.sessionId !== sessionId) return;
    session.state = 'ABANDONED';
    run.lockpick = null;
    // ABANDONED preserves the attempt (disconnect-friendly): attemptAvailable stays true.
    this.emit({
      type: 'lockpickEnd',
      sessionId: session.sessionId,
      outcome: 'abandoned',
      pid: r.meta.entityId,
    });
  }

  /** Claim item loot from an opened delve chest (shown on the loot overlay). */
  collectDelveChestLoot(chestId: number, pid?: number): void {
    runsMod.collectDelveChestLoot(this.ctx, chestId, pid);
  }

  /** Tear down any active lockpick session on a run (player left / disconnected). */
  private abandonLockpick(run: DelveRun): void {
    const session = run.lockpick;
    if (session?.state !== 'IN_PROGRESS') return;
    session.state = 'ABANDONED';
    run.lockpick = null;
    this.emit({
      type: 'lockpickEnd',
      sessionId: session.sessionId,
      outcome: 'abandoned',
      pid: session.ownerId,
    });
  }

  private lockpickSucceed(run: DelveRun, session: LockSession): void {
    session.state = 'SUCCESS';
    const state = run.objectState[session.chestId];
    const obj = this.entities.get(session.chestId);
    const ownerCls = this.players.get(session.ownerId)?.cls ?? 'warrior';
    // A solved Bountiful Coffer guarantees the signature rare (see §7.6).
    const isCoffer = run.bountiful && session.chestId === run.rewardChestId;
    const items = delveChestItemsForTier(session.lootTier, ownerCls, this.rng, isCoffer);
    if (state) {
      state.looted = true;
      state.open = true;
      state.triggered = true;
      state.attemptAvailable = false;
      state.lootedTier = session.lootTier;
      state.pendingLoot = items.map((s) => ({ ...s }));
      // Loot belongs to the picker; record it so a non-picker party member who is
      // also standing on the chest cannot front-run the collect.
      state.lootOwnerId = session.ownerId;
    }
    if (obj) {
      obj.name = 'Opened Chest';
      obj.templateId = 'delve_reward_chest';
    }
    this.grantDelveRewards(run);
    this.grantLockpickBonus(run, session.lootTier);
    this.openDelveSurfaceExit(run);
    this.emit({ type: 'delveChestLoot', chestId: session.chestId, items, pid: session.ownerId });
    this.emit({
      type: 'lockpickEnd',
      sessionId: session.sessionId,
      outcome: 'success',
      lootTier: session.lootTier,
      pid: session.ownerId,
    });
    run.lockpick = null;
  }

  private lockpickFail(run: DelveRun, session: LockSession): void {
    session.state = 'FAILED';
    const state = run.objectState[session.chestId];
    if (state) state.attemptAvailable = false; // chest lost, re-clear the delve
    this.emit({
      type: 'lockpickEnd',
      sessionId: session.sessionId,
      outcome: 'fail',
      pid: session.ownerId,
    });
    if (run.partyKey) {
      for (const pid of this.partyMembersForKey(run.partyKey)) {
        this.emit({
          type: 'log',
          text: 'The last pick snaps. The lock jams. The chest is lost unless you clear the delve again.',
          color: '#f88',
          pid,
        });
      }
    }
    // The boss is already dead and the chest is now jammed: open the surface exit
    // so a failed pick can never strand the party in a cleared delve. (Success
    // opens it via lockpickSuccess; this mirrors that for the failure path.)
    this.openDelveSurfaceExit(run);
    run.lockpick = null;
  }

  /** Loot-tier bonus on top of the base delve chest rewards (marks + copper). */
  private grantLockpickBonus(run: DelveRun, tier: 'premium' | 'medium' | 'low'): void {
    const reward = LOCKPICK_TIER_REWARD[tier];
    const delve = DELVES[run.delveId];
    const members = run.partyKey ? this.partyMembersForKey(run.partyKey) : [];
    const baseCopper = Math.round((delve.baseRewards.copperMin + delve.baseRewards.copperMax) / 2);
    const bonusCopper = Math.round(baseCopper * (reward.copperMult - 1));
    for (const pid of members) {
      const meta = this.players.get(pid);
      if (!meta) continue;
      meta.delveMarks += reward.bonusMarks;
      meta.copper += bonusCopper;
      // Structured (no prose crosses the sim boundary): the client builds the
      // localized "spoils" line from the tier token and formats the numbers.
      this.emit({
        type: 'lockpickBonus',
        tier,
        marks: reward.bonusMarks,
        copper: bonusCopper,
        pid,
      });
    }
  }

  /** Read-only projection of the active lockpick attempt for IWorld (offline). */
  lockpickViewFor(pid?: number): LockpickView | null {
    const r = this.resolve(pid);
    if (!r) return null;
    const run = this.delveRunForPlayer(r.meta.entityId);
    const s = run?.lockpick ?? null;
    if (s?.state !== 'IN_PROGRESS' || s.ownerId !== r.meta.entityId) return null;
    const spec = s.pages[s.pageIndex];
    return {
      sessionId: s.sessionId,
      objectId: s.chestId,
      w: spec.tier.cols,
      h: spec.tier.rows,
      col: s.col,
      row: s.row,
      page: s.pageIndex + 1,
      pageCount: s.pages.length,
      tries: s.triesLeft,
      triesTotal: s.triesTotal,
      lootTier: s.lootTier,
      allowed: spec.tier.allowedActions.slice(),
      visible: visibleCells(spec, s.col, spec.tier.visibilityWindow),
      stepTimeoutMs: ANTE_TO_STEP_TIMEOUT_MS[s.ante],
    };
  }

  companionUpgrade(companionId: string, pid?: number): void {
    runsMod.companionUpgrade(this.ctx, companionId, pid);
  }

  delveShopGateMet(meta: PlayerMeta, delveId: string, gate: DelveShopGate): boolean {
    return runsMod.delveShopGateMet(meta, delveId, gate);
  }

  delveShopOffersFor(delveId: string, pid: number): DelveShopOffer[] {
    return runsMod.delveShopOffersFor(this.ctx, delveId, pid);
  }

  delveClearsFor(pid: number): Record<string, number> {
    return runsMod.delveClearsFor(this.ctx, pid);
  }

  delveBuyShopItem(delveId: string, itemId: string, pid?: number): void {
    runsMod.delveBuyShopItem(this.ctx, delveId, itemId, pid);
  }

  delveCompanionWire(pid: number): DelveCompanionInfo | null {
    return runsMod.delveCompanionWire(this.ctx, pid);
  }

  delveRunWire(pid: number): object | null {
    return runsMod.delveRunWire(this.ctx, pid);
  }

  delveMarksFor(pid: number): number {
    return runsMod.delveMarksFor(this.ctx, pid);
  }

  companionUpgradesFor(pid: number): Record<string, number> {
    return runsMod.companionUpgradesFor(this.ctx, pid);
  }

  delveDailyWire(pid: number): { date: string; firstClearXp: string[]; markClears: number } {
    return runsMod.delveDailyWire(this.ctx, pid);
  }

  get delveRun(): DelveRunInfo | null {
    return this.delveRunWire(this.primaryId) as DelveRunInfo | null;
  }

  get delveRunInfo(): DelveRunInfo | null {
    return this.delveRun;
  }

  get companionState(): DelveCompanionInfo | null {
    return this.delveCompanionWire(this.primaryId);
  }

  get lockpickState(): LockpickView | null {
    return this.lockpickViewFor(this.primaryId);
  }

  get delveMarks(): number {
    return this.delveMarksFor(this.primaryId);
  }

  get companionUpgrades(): Record<string, number> {
    return this.companionUpgradesFor(this.primaryId);
  }

  delveShopOffers(delveId: string): DelveShopOffer[] {
    return this.delveShopOffersFor(delveId, this.primaryId);
  }

  get delveDaily(): { date: string; firstClearXp: string[]; markClears: number } {
    return this.delveDailyWire(this.primaryId);
  }
}

export function formatMoney(copper: number): string {
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  const parts: string[] = [];
  if (g > 0) parts.push(`${g}g`);
  if (s > 0) parts.push(`${s}s`);
  if (c > 0 || parts.length === 0) parts.push(`${c}c`);
  return parts.join(' ');
}
