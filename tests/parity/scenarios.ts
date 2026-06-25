// Parity scenarios: deterministic, seed-pinned drives that exercise the sim's
// behavior so that any future extraction is checked against a committed golden.
//
// Coverage matrix (every item is mandatory per the S0a brief):
//  - multiple classes:        warrior / mage / rogue / hunter / warlock / paladin
//  - meleeSwing weaponStrike:  heroic_strike (warrior), sinister_strike (rogue)
//  - auto-attack + mobSwing:   solo_warrior (mob swings back)
//  - frenzy + on-hit affix:    affix_mob (old_greyjaw frenzyOnHit + ridge_stalker bleed)
//  - mob-swing affix cascade:  mob_swing_affixes (stun/venom/silence/rampage + friendly-pet short-circuit, M3)
//  - pets:                     hunter_pet (updateRangedPetAttack), warlock_pet (mobSwing pet arm + applyTaunt)
//  - ground-AoE:               paladin_consecration (updateGroundAoEs first + pulseGroundAoE both callers)
//  - arena + fiesta:           arena_1v1, fiesta
//  - delve + lockpick:         delve_lockpick
//  - loot roll:                solo_warrior (death->rollLoot), party_loot (need/greed)
//
// All drives are MOVE-safe: they only call public Sim methods + the documented
// internal plumbing the existing tests use (createMob/addEntity, dealDamage,
// mobSwing, spawnDelveModule), never reaching into not-yet-extracted internals
// in a way the sim itself does not already expose.

import { arenaOrigin, MOBS, DELVES, QUESTS } from '../../src/sim/data';
import { createMob } from '../../src/sim/entity';
import { Sim } from '../../src/sim/sim';
import { solveLockActions } from '../../src/sim/lockpick';
import { DT, FISHING_CAST_ID, MAX_LEVEL, type Aura, type Entity } from '../../src/sim/types';
import { terrainHeight } from '../../src/sim/world';
import type { Recorder, Scenario } from './record';

// ----- shared helpers ---------------------------------------------------------

type AnySim = Sim & Record<string, any>;
type AnyEntity = Entity & Record<string, any>;

// Move an entity to (x,z) on the terrain and keep the spatial grid consistent —
// the same idiom every existing scenario test uses.
function teleport(sim: AnySim, e: AnyEntity, x: number, z: number): void {
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = terrainHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
  e.vx = 0;
  e.vy = 0;
  e.vz = 0;
  e.onGround = true;
  e.fallStartY = e.pos.y;
  sim.rebucket(e);
}

// Spawn a mob from a template key and register it (entities + spatial grid),
// allocating a fresh id from nextId so it never collides with ctor spawns.
function spawnMob(sim: AnySim, key: string, level: number, x: number, y: number, z: number): AnyEntity {
  const mob = createMob(sim.nextId++, MOBS[key], level, { x, y, z }) as AnyEntity;
  sim.addEntity(mob);
  return mob;
}

// Face `e` toward `target` (sim uses atan2(dx, dz), 0 = +Z).
function face(e: AnyEntity, target: AnyEntity): void {
  e.facing = Math.atan2(target.pos.x - e.pos.x, target.pos.z - e.pos.z);
}

// Make an entity a damage sponge so a scenario can run long enough to fire its
// target path repeatedly without anyone dying early.
function beef(e: AnyEntity, hp = 50000): void {
  e.maxHp = hp;
  e.hp = hp;
}

// Aggro `mob` onto `target` so the mob's tick AI drives real mobSwing calls.
function aggroOnto(mob: AnyEntity, target: AnyEntity): void {
  mob.hostile = true;
  mob.aiState = 'attack';
  mob.aggroTargetId = target.id;
  mob.targetId = target.id;
}

const lethal = (sim: AnySim, src: AnyEntity | null, target: AnyEntity): void => {
  sim.dealDamage(src, target, target.maxHp + 1000, false, 'physical', null, 'hit', true);
};

// ----- scenarios --------------------------------------------------------------

// Warrior: auto-attack + heroic_strike (the castAbility -> meleeSwing weaponStrike
// entry) against a mob that swings back (base mobSwing), then a lethal blow that
// runs the death -> rollLoot path.
function soloWarrior(): Scenario {
  return {
    name: 'solo_warrior',
    coverage: [
      'class:warrior',
      'meleeSwing weaponStrike (heroic_strike via castAbility ~3736)',
      'player auto-attack (C5)',
      'base mobSwing (mob swings the player)',
      'rollLoot via mob death (L1, ~5876/6036)',
    ],
    build: () => new Sim({ seed: 1001, playerClass: 'warrior', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      sim.setPlayerLevel(10);
      const p = sim.player as AnyEntity;
      beef(p);
      const mob = spawnMob(sim, 'forest_wolf', 2, p.pos.x + 2, p.pos.y, p.pos.z);
      beef(mob, 6000);
      rec.track(mob.id);
      teleport(sim, p, mob.pos.x - 1.5, mob.pos.z);
      face(p, mob);
      sim.targetEntity(mob.id);
      aggroOnto(mob, p);
      sim.startAutoAttack();
      for (let round = 0; round < 6; round++) {
        p.resource = p.maxResource; // keep rage for heroic_strike
        if (p.gcdRemaining <= 0 && !p.castingAbility) sim.castAbility('heroic_strike');
        rec.tick(12);
        face(p, mob);
      }
      // Death -> credit -> rollLoot.
      mob.hp = mob.maxHp;
      lethal(sim, p, mob);
      rec.snapshot('kill');
      rec.tick(4);
    },
  };
}

// Mage: the casting lifecycle (cast time -> effect dispatch -> spell damage)
// driven by repeated fireball/frostbolt at a ranged target.
function soloMage(): Scenario {
  return {
    name: 'solo_mage',
    coverage: ['class:mage (caster)', 'casting lifecycle (C4a)', 'effect dispatch + spell damage (C4b/C1)'],
    build: () => new Sim({ seed: 1002, playerClass: 'mage', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      sim.setPlayerLevel(10);
      const p = sim.player as AnyEntity;
      beef(p);
      const mob = spawnMob(sim, 'forest_wolf', 5, p.pos.x, p.pos.y, p.pos.z + 18);
      beef(mob, 9000);
      rec.track(mob.id);
      face(p, mob);
      sim.targetEntity(mob.id);
      const spells = ['fireball', 'frostbolt'];
      for (let round = 0; round < 8; round++) {
        p.resource = p.maxResource; // mana
        if (p.gcdRemaining <= 0 && !p.castingAbility) sim.castAbility(spells[round % spells.length]);
        rec.tick(16);
        face(p, mob);
      }
    },
  };
}

// Rogue: sinister_strike (another castAbility -> meleeSwing weaponStrike entry)
// building combo points.
function soloRogue(): Scenario {
  return {
    name: 'solo_rogue',
    coverage: ['class:rogue', 'meleeSwing weaponStrike (sinister_strike via castAbility ~3736)', 'combo points'],
    build: () => new Sim({ seed: 1003, playerClass: 'rogue', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      sim.setPlayerLevel(10);
      const p = sim.player as AnyEntity;
      beef(p);
      const mob = spawnMob(sim, 'forest_wolf', 5, p.pos.x + 2, p.pos.y, p.pos.z);
      beef(mob, 9000);
      rec.track(mob.id);
      teleport(sim, p, mob.pos.x - 1.5, mob.pos.z);
      face(p, mob);
      sim.targetEntity(mob.id);
      aggroOnto(mob, p);
      sim.startAutoAttack();
      for (let round = 0; round < 6; round++) {
        p.resource = p.maxResource; // energy
        if (p.gcdRemaining <= 0 && !p.castingAbility) sim.castAbility('sinister_strike');
        rec.tick(12);
        face(p, mob);
      }
    },
  };
}

// Frenzy + on-hit affix cascade: the player hits old_greyjaw (frenzyOnHit ->
// blood_frenzy buff) while ridge_stalker swings the player (bleed on-hit affix).
// Both procs are forced deterministically by pinning the affix chance to 1 (which
// still draws rng through the real path, so the draw log stays meaningful) and
// restored afterward so the shared MOBS table is left untouched.
function affixMob(): Scenario {
  return {
    name: 'affix_mob',
    coverage: [
      'frenzyOnHit (old_greyjaw -> blood_frenzy)',
      'on-hit affix cascade via mobSwing (ridge_stalker bleed, ~7070/7100)',
      'applyTaunt player-cast arm (taunt ability, ~4279)',
      'class:warrior',
    ],
    build: () => new Sim({ seed: 1004, playerClass: 'warrior', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      sim.setPlayerLevel(13);
      const p = sim.player as AnyEntity;
      beef(p, 90000);
      const greyjaw = spawnMob(sim, 'old_greyjaw', 4, p.pos.x + 2, p.pos.y, p.pos.z);
      const stalker = spawnMob(sim, 'ridge_stalker', 13, p.pos.x - 2, p.pos.y, p.pos.z);
      beef(greyjaw, 60000);
      beef(stalker, 60000);
      aggroOnto(greyjaw, p);
      aggroOnto(stalker, p);
      rec.track(greyjaw.id, stalker.id);
      teleport(sim, p, greyjaw.pos.x - 1.5, greyjaw.pos.z);

      const greyTrait = MOBS.old_greyjaw.frenzyOnHit;
      const stalkBleed = MOBS.ridge_stalker.bleed;
      const greyOrig = greyTrait ? greyTrait.chance : undefined;
      const bleedOrig = stalkBleed ? stalkBleed.chance : undefined;
      try {
        // Inside the try so the finally restore covers every path (MOBS is a
        // process-wide singleton shared across all scenarios in one test run).
        if (greyTrait) greyTrait.chance = 1;
        if (stalkBleed) stalkBleed.chance = 1;
        for (let round = 0; round < 5; round++) {
          // player wounds greyjaw -> frenzyOnHit proc (source !== target)
          sim.dealDamage(p, greyjaw, 40, false, 'physical', null, 'hit', true);
          // stalker swings player -> bleed on-hit affix (direct, the exerciser path)
          sim.mobSwing(stalker, p);
          rec.tick(10);
        }
      } finally {
        if (greyTrait && greyOrig !== undefined) greyTrait.chance = greyOrig;
        if (stalkBleed && bleedOrig !== undefined) stalkBleed.chance = bleedOrig;
      }
      // Player-cast taunt on the (still-alive, beefed) greyjaw -> applyTaunt ~4279.
      sim.targetEntity(greyjaw.id);
      sim.castAbility('taunt');
      rec.snapshot('taunt');
      rec.tick(4);
    },
  };
}

// M3 mob on-hit affix cascade: four hostile mobs, each carrying a distinct
// heavy-hitter affix, swing a player so the cascade's per-template proc rng.chance
// rolls fire at fixed stream positions and land their auras (stun / venom DoT /
// silence, chances pinned to 1 in a try/finally so the shared MOBS table is restored;
// rampage self-buff is unconditional). A FRIENDLY (hostile=false) pet also swings a
// separate mob through mobSwing so the load-bearing `mob.hostile` short-circuit branch
// -- which draws NO cascade rng and applies no debuff to the mob it hits -- is pinned
// in the trace too. The affix mobs sit one level above the player so the base hit
// table lands reliably (a missed/dodged base swing short-circuits the whole cascade).
function mobSwingAffixes(): Scenario {
  return {
    name: 'mob_swing_affixes',
    coverage: [
      'mobSwing affix cascade: stunOnHit (mogger_lackey -> stun aura on player)',
      'mobSwing affix cascade: venom DoT (webwood_spider -> dot aura on player)',
      'mobSwing affix cascade: silence (gravecaller_summoner -> silence aura on player)',
      'mobSwing affix cascade: rampage stacking buff_ap (warlord_drogmar self-buff)',
      'friendly-pet mobSwing: mob.hostile=false short-circuits every proc (no debuff on its target)',
    ],
    build: () => new Sim({ seed: 1007, playerClass: 'warrior', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      sim.setPlayerLevel(16);
      const p = sim.player as AnyEntity;
      // beef() does not stick on a player (applyAura -> recalcPlayerStats resets maxHp,
      // and several affixes ride negative buff_* drains); top the player up right before
      // each swing so it survives every draw, mirroring mob_locomotion's reviveTarget.
      const topUp = () => {
        p.hp = 1_000_000;
      };
      const lackey = spawnMob(sim, 'mogger_lackey', 18, p.pos.x + 2, p.pos.y, p.pos.z);
      const spider = spawnMob(sim, 'webwood_spider', 18, p.pos.x - 2, p.pos.y, p.pos.z);
      const summoner = spawnMob(sim, 'gravecaller_summoner', 18, p.pos.x + 3, p.pos.y, p.pos.z);
      const drogmar = spawnMob(sim, 'warlord_drogmar', 18, p.pos.x - 3, p.pos.y, p.pos.z);
      for (const m of [lackey, spider, summoner, drogmar]) {
        beef(m, 200000);
        aggroOnto(m, p);
      }
      // Friendly pet: a hostile=false forest_wolf (affix-free) swinging a separate mob.
      // Every cascade guard short-circuits on its hostile flag, so it deals base damage
      // but applies no on-hit debuff to the mob it hits.
      const pet = spawnMob(sim, 'forest_wolf', 8, p.pos.x + 1, p.pos.y, p.pos.z);
      pet.ownerId = p.id;
      pet.hostile = false;
      const dummy = spawnMob(sim, 'forest_wolf', 8, p.pos.x + 9, p.pos.y, p.pos.z);
      beef(dummy, 200000);
      rec.track(lackey.id, spider.id, summoner.id, drogmar.id, pet.id, dummy.id);
      rec.notes.petId = pet.id;
      rec.notes.dummyId = dummy.id;
      teleport(sim, p, lackey.pos.x - 1.5, lackey.pos.z);

      // OR-accumulate "ever landed" across rounds so a single base miss never makes the
      // coverage assertion flaky; deterministic for this seed (the golden pins it).
      let stunLanded = false;
      let venomLanded = false;
      let silenceLanded = false;
      let rampageStacks = 0;
      let dummyDebuffs = 0;

      const stun = MOBS.mogger_lackey.stunOnHit;
      const venom = MOBS.webwood_spider.venom;
      const silence = MOBS.gravecaller_summoner.silence;
      const stunOrig = stun ? stun.chance : undefined;
      const venomOrig = venom ? venom.chance : undefined;
      const silenceOrig = silence ? silence.chance : undefined;
      try {
        if (stun) stun.chance = 1;
        if (venom) venom.chance = 1;
        if (silence) silence.chance = 1;
        for (let round = 0; round < 6; round++) {
          topUp();
          sim.mobSwing(lackey, p);
          topUp();
          sim.mobSwing(spider, p);
          topUp();
          sim.mobSwing(summoner, p);
          topUp();
          sim.mobSwing(drogmar, p);
          stunLanded = stunLanded || p.auras.some((a: any) => a.id === 'stun_mogger_lackey');
          venomLanded = venomLanded || p.auras.some((a: any) => a.id === 'venom_webwood_spider');
          silenceLanded =
            silenceLanded || p.auras.some((a: any) => a.id === 'silence_gravecaller_summoner');
          rampageStacks = Math.max(
            rampageStacks,
            drogmar.auras.find((a: any) => a.id === 'rampage_warlord_drogmar')?.stacks ?? 0,
          );
          // Friendly pet swings the dummy: base hit only, no cascade procs.
          sim.mobSwing(pet, dummy);
          dummyDebuffs = Math.max(dummyDebuffs, dummy.auras.length);
          rec.tick(10);
        }
      } finally {
        if (stun && stunOrig !== undefined) stun.chance = stunOrig;
        if (venom && venomOrig !== undefined) venom.chance = venomOrig;
        if (silence && silenceOrig !== undefined) silence.chance = silenceOrig;
      }
      rec.notes.stunLanded = stunLanded;
      rec.notes.venomLanded = venomLanded;
      rec.notes.silenceLanded = silenceLanded;
      rec.notes.rampageStacks = rampageStacks;
      rec.notes.dummyDebuffs = dummyDebuffs;
      topUp();
      rec.snapshot('affixes');
      rec.tick(4);
    },
  };
}

// Ranged pet spell path, BOTH callers of updateRangedPetAttack:
//  - friendly arm (~8093): a ranged_dps pet (warlock_imp: petSpell Firebolt)
//    adopted onto the hunter.
//  - hostile mob arm (~6776): a WILD warlock_imp (ownerId null) whose attack-state
//    AI fires its petSpell at the player.
function hunterPet(): Scenario {
  return {
    name: 'hunter_pet',
    coverage: [
      'class:hunter',
      'updateRangedPetAttack friendly pet arm (~8093/8217)',
      'updateRangedPetAttack hostile-mob arm (~6776)',
    ],
    build: () => new Sim({ seed: 1005, playerClass: 'hunter', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      sim.setPlayerLevel(12);
      const p = sim.player as AnyEntity;
      beef(p);
      const pet = spawnMob(sim, 'warlock_imp', 8, p.pos.x + 1, p.pos.y, p.pos.z);
      pet.ownerId = p.id;
      pet.hostile = false;
      pet.hp = pet.maxHp;
      pet.petMode = 'aggressive';
      rec.track(pet.id);
      const target = spawnMob(sim, 'forest_wolf', 8, p.pos.x + 7, p.pos.y, p.pos.z);
      beef(target);
      aggroOnto(target, p);
      pet.aggroTargetId = target.id;
      rec.track(target.id);
      // A wild (hostile, un-owned) petSpell mob whose AI shoots the player -> 6776.
      const hostileImp = spawnMob(sim, 'warlock_imp', 8, p.pos.x - 8, p.pos.y, p.pos.z);
      hostileImp.ownerId = null;
      beef(hostileImp);
      aggroOnto(hostileImp, p);
      rec.track(hostileImp.id);
      rec.notes.hostileImpId = hostileImp.id;
      sim.targetEntity(target.id);
      sim.startAutoAttack();
      rec.tick(120); // 6s: friendly Firebolt every 2s + hostile imp shoots the player
    },
  };
}

// Warlock melee pet: summon_voidwalker (melee_tank) swings through the pet arm of
// mobSwing and taunts via the applyTaunt pet arm.
function warlockPet(): Scenario {
  return {
    name: 'warlock_pet',
    coverage: [
      'class:warlock (caster)',
      'mobSwing pet arm (voidwalker melee ~8117)',
      'applyTaunt pet auto-taunt arm (~8110)',
      'applyTaunt pet manual-taunt arm (petTaunt, ~4885)',
    ],
    build: () => new Sim({ seed: 1006, playerClass: 'warlock', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      sim.setPlayerLevel(12);
      const p = sim.player as AnyEntity;
      beef(p);
      p.resource = p.maxResource;
      sim.castAbility('summon_voidwalker');
      for (let i = 0; i < 20 * 12 && p.castingAbility; i++) rec.tick(1);
      const pet = sim.petOf(sim.playerId) as AnyEntity | null;
      if (pet) {
        rec.track(pet.id);
        pet.petMode = 'aggressive';
        pet.petAutoTaunt = true;
        pet.petTauntTimer = 0;
      }
      const target = spawnMob(sim, 'forest_wolf', 8, p.pos.x + 5, p.pos.y, p.pos.z);
      beef(target);
      aggroOnto(target, p);
      if (pet) pet.aggroTargetId = target.id;
      rec.track(target.id);
      sim.targetEntity(target.id);
      sim.startAutoAttack();
      rec.tick(120);
      // Manual pet taunt: place the pet in PET_TAUNT_RANGE (5) and command it ->
      // applyTaunt via petTaunt (~4885), distinct from the auto-taunt arm (~8110).
      if (pet) {
        pet.pos = { x: target.pos.x - 1, y: target.pos.y, z: target.pos.z };
        pet.prevPos = { ...pet.pos };
        sim.rebucket(pet);
        pet.petTauntTimer = 0;
        sim.petTaunt();
        rec.snapshot('pet-taunt');
        rec.tick(4);
      }
    },
  };
}

// Paladin Consecration: a ground AoE so updateGroundAoEs (which runs FIRST in the
// tick) and pulseGroundAoE fire from BOTH callers (the immediate on-cast pulse and
// the deferred interval pulses).
function paladinConsecration(): Scenario {
  return {
    name: 'paladin_consecration',
    coverage: [
      'class:paladin',
      'updateGroundAoEs first-in-tick (~2256)',
      'pulseGroundAoE both callers (immediate ~4097 + deferred ~3052)',
    ],
    build: () => new Sim({ seed: 1007, playerClass: 'paladin', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      sim.setPlayerLevel(20); // consecration learnLevel 18
      const p = sim.player as AnyEntity;
      beef(p);
      const mob = spawnMob(sim, 'forest_wolf', 5, p.pos.x, p.pos.y, p.pos.z + 3);
      beef(mob, 40000);
      mob.hostile = true;
      rec.track(mob.id);
      teleport(sim, p, mob.pos.x, mob.pos.z - 2); // mob within the 8yd radius
      sim.targetEntity(mob.id);
      p.resource = p.maxResource;
      rec.tick(1);
      p.gcdRemaining = 0;
      sim.castAbility('consecration'); // pushes the ground AoE; immediate pulse fires
      rec.tick(20 * 10); // 10s: interval-2 deferred pulses
    },
  };
}

// Arena 1v1: queue two solos, run the countdown to active, then force a kill so
// the Elo result lands on both players' PlayerMeta (arenaRating/Wins/Losses).
function arena1v1(): Scenario {
  return {
    name: 'arena_1v1',
    coverage: ['arena 1v1 match + Elo result', 'multi-player PlayerMeta sampling', 'classes:warrior,mage'],
    sampleEvery: 25,
    build: () => new Sim({ seed: 1008, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const a = sim.addPlayer('warrior', 'Aleph');
      const b = sim.addPlayer('mage', 'Bet');
      teleport(sim, sim.entities.get(a)!, 0, -40);
      teleport(sim, sim.entities.get(b)!, 6, -40);
      sim.arenaQueueJoin(a);
      sim.arenaQueueJoin(b);
      rec.tick(1); // matchmake
      for (let i = 0; i < 20 * 8; i++) {
        rec.tick(1);
        const m = sim.arenaMatchFor(a);
        if (m && m.state === 'active') break;
      }
      const ea = sim.entities.get(a) as AnyEntity;
      const eb = sim.entities.get(b) as AnyEntity;
      sim.dealDamage(ea, eb, 99999, false, 'physical', null, 'hit');
      rec.tick(1); // arenaEnd + rating update
      rec.tick(20 * 2);
    },
  };
}

// Fiesta: queue four solos into the score-based 2v2 party mode, run to active,
// then force a cross-team kill (scores a point + benches the victim on a respawn
// timer). Exercises fiesta match logic; the fiesta sub-stream's effects surface
// through PlayerMeta + match state.
function fiesta(): Scenario {
  return {
    name: 'fiesta',
    coverage: [
      'fiesta match (2v2 score mode)',
      'cross-team takedown + respawn bench',
      'augment wave: fiestaPickOffers + arenaAugmentPick (fiestaAugments on meta + augmentOffer/Chosen events)',
      'multi-player meta',
    ],
    sampleEvery: 25,
    build: () => new Sim({ seed: 1009, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const classes: Array<'warrior' | 'mage' | 'rogue' | 'hunter'> = ['warrior', 'mage', 'rogue', 'hunter'];
      const pids = classes.map((c, i) => sim.addPlayer(c, `P${i}`));
      pids.forEach((pid, i) => teleport(sim, sim.entities.get(pid)!, i * 4, -40));
      pids.forEach((pid) => sim.arenaQueueJoin(pid, 'fiesta'));
      rec.tick(1);
      for (let i = 0; i < 20 * 10; i++) {
        rec.tick(1);
        const m = sim.arenaMatchFor(pids[0]);
        if (m && m.state === 'active') break;
      }
      const match = sim.arenaMatchFor(pids[0]);
      if (match && match.fiesta && match.teamA.length && match.teamB.length) {
        const victimPid = match.teamB[0];
        const killer = sim.entities.get(match.teamA[0]) as AnyEntity;
        const victim = sim.entities.get(victimPid) as AnyEntity;
        // 6-arg form (kind defaulted) matches how the fiesta test drives a takedown.
        (sim as any).dealDamage(killer, victim, victim.maxHp + 50, false, 'physical', null);
        rec.tick(1); // fiestaDown + score; victim is now benched (down)
        // Open an augment wave: the downed victim is offered augments (drawing the
        // fiesta sub-stream via fiestaPickOffers), then picks one -> fiestaAugments.
        (sim as any).fiestaOpenWave(match);
        const offer = match.fiesta.offers.get(victimPid);
        if (offer && offer.choices.length) sim.arenaAugmentPick(offer.choices[0], victimPid);
        rec.notes.fiestaVictimPid = victimPid;
        rec.tick(1);
      }
      rec.tick(20 * 3);
    },
  };
}

// Fiesta power-ups, hazard ring, and respawn revive (A3). Seats a 2v2 Fiesta, runs
// until the first power-up spawns (fiestaSpawnPowerup draws the PER-MATCH f.rng: one
// pick + two next() for placement), telegraphs it to ready, walks a live fighter
// onto it (fiestaGrabPowerup applies a buff aura), then closes the ring and pushes a
// fighter outside (fiestaRingDamage burn), and finally downs a fighter and runs
// their respawn timer out (fiestaRevive). The per-match f.rng power-up placement
// surfaces in the full-state trace (powerup defId/x/z); the SHARED this.rng
// draw-order digest is untouched (fiesta match logic draws only the per-match
// stream). Complements `fiesta` (takedown + augment wave) with the power-up / ring /
// revive arms it does not reach.
function fiestaPowerups(): Scenario {
  return {
    name: 'fiesta_powerups',
    coverage: [
      'fiesta power-up spawn (f.rng pick/next) + telegraph + grab (buff aura)',
      'hazard ring burn (fiestaRingDamage) outside the closing ring',
      'down + respawn-timer revive (fiestaRevive)',
    ],
    sampleEvery: 10,
    build: () => new Sim({ seed: 2027, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const classes: Array<'warrior' | 'mage' | 'rogue' | 'priest'> = ['warrior', 'mage', 'rogue', 'priest'];
      const pids = classes.map((c, i) => sim.addPlayer(c, `P${i}`));
      pids.forEach((pid, i) => teleport(sim, sim.entities.get(pid)!, i * 4, -40));
      pids.forEach((pid) => sim.arenaQueueJoin(pid, 'fiesta'));
      rec.tick(1);
      for (let i = 0; i < 20 * 10; i++) {
        rec.tick(1);
        const m = sim.arenaMatchFor(pids[0]);
        if (m && m.state === 'active') break;
      }
      const match = sim.arenaMatchFor(pids[0]);
      if (match && match.fiesta) {
        const f = match.fiesta;
        // First power-up attempt is ~12s into the bout; run until one spawns.
        for (let i = 0; i < 20 * 20 && f.powerups.length === 0; i++) rec.tick(1);
        // Telegraph -> ready.
        for (let i = 0; i < 20 * 6 && f.powerups[0]?.state === 'spawning'; i++) rec.tick(1);
        // Walk a live fighter onto the ready power-up so it is grabbed (buff aura).
        const p = f.powerups[0];
        if (p && p.state === 'ready') {
          const grabPid = match.teamA[0];
          teleport(sim, sim.entities.get(grabPid)! as AnyEntity, p.x, p.z);
          rec.tick(1);
        }
        // Hazard ring: close it tight and push a fighter well outside -> burn.
        f.ringRadius = 6;
        const origin = arenaOrigin(match.slot);
        const ringPid = match.teamA[0];
        teleport(sim, sim.entities.get(ringPid)! as AnyEntity, origin.x + 30, origin.z);
        rec.tick(20); // ~1s; the ring burns twice a second
        // Down a cross-team fighter, then run their respawn timer out -> revive.
        const victimPid = match.teamB[0];
        const killer = sim.entities.get(match.teamA[0]) as AnyEntity;
        const victim = sim.entities.get(victimPid) as AnyEntity;
        (sim as any).dealDamage(killer, victim, victim.maxHp + 50, false, 'physical', null);
        rec.notes.fiestaPowerupVictimPid = victimPid;
        const downedFor = f.respawn.get(victimPid) ?? 5;
        rec.tick(Math.ceil(downedFor * 20) + 10);
      }
      rec.tick(20 * 2);
    },
  };
}

// Duel to a winner (A2): two adjacent players, duelRequest -> duelAccept, run the
// DUEL_COUNTDOWN out so the bout is live, then one lands a finishing blow. The
// dealDamage 1-HP duel guard ends the bout via endDuel (a winner/loser duelEnd,
// the loser clamped to 1 hp, this.duels cleared). This slice draws no rng of its
// own, so the draw-order digest must stay byte-identical across the move.
function duelToWinner(): Scenario {
  return {
    name: 'duel_to_winner',
    coverage: [
      'duelRequest/duelAccept duel formation (~11982/12022)',
      'updateDuels countdown -> active + duelStart',
      'endDuel on a PvP finishing blow (winner/loser + this.duels cleared)',
    ],
    build: () => new Sim({ seed: 1015, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const a = sim.addPlayer('warrior', 'Aleph', { autoEquip: true });
      const b = sim.addPlayer('mage', 'Bet', { autoEquip: true });
      teleport(sim, sim.entities.get(a)!, 0, -40);
      teleport(sim, sim.entities.get(b)!, 4, -40);
      rec.track(a, b);
      sim.duelRequest(b, a); // Aleph challenges Bet
      sim.duelAccept(b); // Bet accepts -> countdown
      // run the 3s countdown (TICK_RATE 20) out so the duel flips to 'active'.
      for (let i = 0; i < 20 * 4; i++) {
        rec.tick(1);
        const d = sim.duels.get(a);
        if (d && d.state === 'active') break;
      }
      rec.snapshot('duel-active');
      // Aleph lands a finishing blow; the 1-HP duel guard ends the bout with
      // Aleph as the winner (Bet survives at 1 hp, the duel is cleared).
      const ea = sim.entities.get(a) as AnyEntity;
      const eb = sim.entities.get(b) as AnyEntity;
      sim.dealDamage(ea, eb, eb.hp + 1000, false, 'physical', 'Finisher', 'hit');
      rec.snapshot('duel-ended');
      rec.tick(20 * 2);
    },
  };
}

// Arena 2v2 to a team wipe (A2): queue four solos into one 2v2 match, run the
// countdown to active, then drop BOTH of teamB. The first death does NOT end the
// match; the second wipes the team (isArenaTeamWiped) so endArenaMatch scores a
// ranked, symmetric Elo delta on all four metas (arena2v2 standings, floored at
// ARENA_MIN_RATING), then returnFromArena sends survivors home after the aftermath.
function arena2v2Wipe(): Scenario {
  return {
    name: 'arena_2v2_wipe',
    coverage: [
      'arena 2v2 matchmaking (matchmakeTeamFormat: four solos -> two teams)',
      'first kill does not end the match; team wipe (isArenaTeamWiped) does',
      'endArenaMatch ranked Elo on both teams (arena2v2 standings) + returnFromArena',
    ],
    sampleEvery: 25,
    build: () => new Sim({ seed: 1016, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const classes: Array<'warrior' | 'mage' | 'rogue' | 'priest'> = ['warrior', 'mage', 'rogue', 'priest'];
      const names = ['Aleph', 'Bet', 'Gimel', 'Dalet'];
      const pids = classes.map((c, i) => sim.addPlayer(c, names[i]));
      pids.forEach((pid, i) => teleport(sim, sim.entities.get(pid)!, i * 3, -40));
      rec.track(...pids);
      pids.forEach((pid) => sim.arenaQueueJoin(pid, '2v2'));
      rec.tick(1); // matchmake seats the four solos into one 2v2 match
      for (let i = 0; i < 20 * 8; i++) {
        rec.tick(1);
        const m = sim.arenaMatchFor(pids[0]);
        if (m && m.state === 'active') break;
      }
      const match = sim.arenaMatchFor(pids[0]);
      if (match && match.teamA.length === 2 && match.teamB.length === 2) {
        rec.snapshot('bout-active');
        const killer = sim.entities.get(match.teamA[0]) as AnyEntity;
        // First takedown: teamB[0] dies but the team is not wiped -> match active.
        sim.dealDamage(killer, sim.entities.get(match.teamB[0]) as AnyEntity, 99999, false, 'physical', null, 'hit');
        rec.tick(1);
        rec.snapshot('first-down');
        // Second takedown: teamB is wiped -> endArenaMatch (ranked Elo on all four).
        sim.dealDamage(killer, sim.entities.get(match.teamB[1]) as AnyEntity, 99999, false, 'physical', null, 'hit');
        rec.tick(1);
        rec.snapshot('team-wiped');
      }
      // run the aftermath out so returnFromArena frees the slot + sends them home.
      for (let i = 0; i < 20 * 7; i++) rec.tick(1);
      rec.snapshot('returned');
    },
  };
}

// Delve + lockpick: enter the Collapsed Reliquary finale, pin the module so it is
// deterministic, kill the boss, then pick the reward chest flawlessly. Exercises
// the delve run progression, the lockpick minigame, and the reward-chest loot.
function delveLockpick(): Scenario {
  return {
    name: 'delve_lockpick',
    coverage: [
      'delve run (collapsed_reliquary finale)',
      'mobSwing delve-companion caller (~16762)',
      'lockpick minigame (flawless solve)',
      'reward chest + delve marks',
    ],
    sampleEvery: 10,
    build: () => new Sim({ seed: 1010, playerClass: 'rogue', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const def = DELVES.collapsed_reliquary;
      sim.setPlayerLevel(def.minLevel);
      const p = sim.player as AnyEntity;
      beef(p);
      teleport(sim, p, def.doorPos.x, def.doorPos.z);
      sim.enterDelve('collapsed_reliquary', 'normal');
      const run = sim.delveRunForPlayer(sim.playerId);
      if (!run) {
        rec.tick(2);
        return;
      }
      run.bountiful = false; // pin against the rare coffer roll
      run.modules = ['reliquary_finale'];
      run.moduleIndex = 0;
      (sim as any).spawnDelveModule(run);
      const boss = [...sim.entities.values()].find((e: AnyEntity) => e.templateId === 'deacon_varric') as
        | AnyEntity
        | undefined;
      // Let the auto-spawned delve companion swing the boss -> mobSwing companion
      // caller (~16762) before we kill it. The companion prefers the owner's target.
      const comp = run.companion ? (sim.entities.get(run.companion.entityId) as AnyEntity | undefined) : undefined;
      if (boss && comp) {
        boss.hostile = true;
        comp.pos = { x: boss.pos.x + 1, y: boss.pos.y, z: boss.pos.z };
        comp.prevPos = { ...comp.pos };
        comp.swingTimer = 0;
        sim.rebucket(comp);
        sim.targetEntity(boss.id);
        rec.track(comp.id, boss.id);
        rec.notes.companionId = comp.id;
        rec.tick(30); // companion swings the boss
      }
      if (boss) {
        rec.track(boss.id);
        lethal(sim, p, boss);
      }
      rec.tick(4); // reward chest spawns
      const chestId = run.rewardChestId;
      if (chestId != null) {
        rec.track(chestId);
        const chest = sim.entities.get(chestId) as AnyEntity;
        p.pos = { ...chest.pos };
        p.prevPos = { ...chest.pos };
        sim.rebucket(p);
        sim.lockpickEngage(chestId, 1);
        rec.tick(1);
        let guard = 0;
        while (run.lockpick && run.lockpick.state === 'IN_PROGRESS' && guard++ < 50) {
          const actions = solveLockActions(run.lockpick.pages[run.lockpick.pageIndex]);
          if (!actions || actions.length === 0) break;
          for (const action of actions) sim.lockpickAction(action);
          rec.tick(1);
        }
      }
      rec.snapshot('delve-end');
      rec.tick(2);
    },
  };
}

// Party loot: a need/greed roll over a party-tagged corpse carrying a premium
// item. Exercises lootCorpse -> lootRoll -> submitLootRoll resolution.
function partyLoot(): Scenario {
  return {
    name: 'party_loot',
    coverage: ['party need/greed loot roll (lootCorpse/submitLootRoll)', 'multi-player party'],
    build: () => new Sim({ seed: 1011, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const a = sim.addPlayer('warrior', 'Aaa');
      const b = sim.addPlayer('mage', 'Bbb');
      sim.partyInvite(b, a);
      sim.partyAccept(b);
      teleport(sim, sim.entities.get(a)!, 20, 20);
      teleport(sim, sim.entities.get(b)!, 21, 20);
      const mob = createMob(sim.nextId++, MOBS.forest_wolf, 2, {
        x: 20,
        y: terrainHeight(20, 22, sim.cfg.seed),
        z: 22,
      }) as AnyEntity;
      mob.dead = true;
      mob.lootable = true;
      mob.tappedById = a;
      mob.loot = { copper: 0, items: [{ itemId: 'greyjaw_hide_boots', count: 1 }] };
      sim.addEntity(mob);
      rec.track(mob.id);
      sim.lootCorpse(mob.id, a);
      rec.tick(1);
      const rollEv = rec.allEvents.find((e: any) => e.type === 'lootRoll') as any;
      if (rollEv) {
        sim.submitLootRoll(rollEv.rollId, 'need', a);
        sim.submitLootRoll(rollEv.rollId, 'need', b);
      }
      rec.tick(2);
    },
  };
}

// Entity roster (E1): the spawn/despawn/decay plumbing, the delayed-event drain,
// and the outdoor player release-spirit path. Spawns mobs via addEntity, expires
// them through BOTH despawn branches (despawnTimer + the idle-despawn timer on a
// DAMAGE_IDLE_DESPAWN mob) so the prologue collect-then-drop loop fires; schedules
// three delayed events (due+fires, due+guard-fails-and-drops, future+stays-pending)
// so emitDueDelayedEvents exercises every branch; then kills the player and releases
// the spirit to the zone graveyard (full hp, auras + ccDr cleared, out of combat).
function entityRoster(): Scenario {
  return {
    name: 'entity_roster',
    coverage: [
      'addEntity roster + spatial grids',
      'despawn prologue: despawnTimer + DAMAGE_IDLE_DESPAWN idle-despawn (collect-then-drop)',
      'emitDueDelayedEvents drain (fires / guard-drops / stays-pending)',
      'releaseSpirit outdoor graveyard respawn (full hp, ~10966)',
    ],
    sampleEvery: 2,
    build: () => new Sim({ seed: 1012, playerClass: 'warrior', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      sim.setPlayerLevel(10);
      const p = sim.player as AnyEntity;
      beef(p);
      // (1a) despawnTimer churn: a far, quiescent mob set to expire in ~2 ticks.
      const ghost = spawnMob(sim, 'forest_wolf', 2, p.pos.x + 200, p.pos.y, p.pos.z + 200);
      ghost.hostile = false;
      ghost.despawnTimer = 0.1;
      rec.track(ghost.id);
      // (1b) idle-despawn churn: a DAMAGE_IDLE_DESPAWN mob, idle + out of combat,
      // with its idle timer pre-seeded so the second despawn branch fires.
      const guard = spawnMob(sim, 'varkas_boneguard', 30, p.pos.x - 200, p.pos.y, p.pos.z - 200);
      guard.hostile = false;
      guard.inCombat = false;
      guard.damageIdleDespawnTimer = 0.1;
      rec.track(guard.id);
      rec.notes.ghostId = ghost.id;
      rec.notes.guardId = guard.id;
      // (2) delayed-event drain: one due+fires, one due+guard-false (dropped), one
      // future (stays pending). delayedEvents is the field this slice owns.
      const delayed = (sim as any).delayedEvents as { at: number; event: any; guard?: () => boolean }[];
      delayed.push({ at: sim.time + 0.05, event: { type: 'respawn', pid: p.id } });
      delayed.push({ at: sim.time + 0.05, event: { type: 'respawn', pid: p.id }, guard: () => false });
      delayed.push({ at: sim.time + 100, event: { type: 'respawn', pid: p.id } });
      rec.tick(5); // both mobs despawn (0.1s) and the due delayed events resolve
      rec.snapshot('post-churn');
      // (4) outdoor release-spirit -> zone graveyard at FULL hp.
      p.hp = 1;
      p.dead = true;
      sim.releaseSpirit();
      rec.snapshot('graveyard-release');
      rec.tick(2);
    },
  };
}

// Delve player death (E1, merged E2): the in-delve release-spirit path. First death
// respawns at the module entry at 50% hp; a second death in the same run fails the
// run (no respawn) and ejects to the board door.
function delveDeath(): Scenario {
  return {
    name: 'delve_death',
    coverage: [
      'releaseSpiritInDelve first death (50% hp respawn at module entry, ~16345)',
      'releaseSpiritInDelve second death fails the run (deathsThisRun >= 2)',
      'rebucket after delve respawn teleport',
    ],
    sampleEvery: 5,
    build: () => new Sim({ seed: 1013, playerClass: 'rogue', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const def = DELVES.collapsed_reliquary;
      sim.setPlayerLevel(def.minLevel);
      const p = sim.player as AnyEntity;
      beef(p);
      teleport(sim, p, def.doorPos.x, def.doorPos.z);
      sim.enterDelve('collapsed_reliquary', 'normal');
      const run = sim.delveRunForPlayer(sim.playerId);
      if (!run) {
        rec.tick(2);
        return;
      }
      run.bountiful = false; // pin against the rare coffer roll
      run.modules = ['reliquary_finale'];
      run.moduleIndex = 0;
      (sim as any).spawnDelveModule(run);
      // First death: 50% hp respawn at the module entry.
      p.dead = true;
      sim.releaseSpirit();
      rec.snapshot('delve-first-release');
      // Second death in the same run: fails the run (delveFailed, ejected).
      const e2 = sim.entities.get(sim.playerId) as AnyEntity;
      e2.dead = true;
      sim.releaseSpirit();
      rec.tick(2); // failDelveRun's delveFailed is queued, drained on the next tick
      rec.snapshot('delve-fail');
    },
  };
}

// C1 damage core: kill a player who is mid-cast inside a fiesta. Pins the
// dealDamage cross-team lethal arm's emit-THEN-fiestaTakedown order, plus the
// mid-cast interaction both ways: a non-lethal hit on a normal cast pushes the cast
// back (pushbackCast ~5664) and a non-lethal hit on the fishing cast cancels it
// (cancelCast ~5663). Mirrors the fiesta matchmaking flow so the match reaches
// active before the takedown.
function fiestaMidcastKill(): Scenario {
  return {
    name: 'fiesta_midcast_kill',
    coverage: [
      'dealDamage fiesta mid-cast pushback (pushbackCast ~5664)',
      'dealDamage fiesta mid-cast fishing-cancel (cancelCast ~5663)',
      'dealDamage fiesta cross-team takedown emit-then-fiestaTakedown order (~5512-5525)',
      'fiesta lifesteal augment arm (~5499)',
      'multi-player fiesta meta',
    ],
    sampleEvery: 25,
    build: () => new Sim({ seed: 1014, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const classes: Array<'warrior' | 'mage' | 'rogue' | 'hunter'> = ['warrior', 'mage', 'rogue', 'hunter'];
      const pids = classes.map((c, i) => sim.addPlayer(c, `F${i}`));
      pids.forEach((pid, i) => teleport(sim, sim.entities.get(pid)!, i * 4, -40));
      pids.forEach((pid) => sim.arenaQueueJoin(pid, 'fiesta'));
      rec.tick(1);
      for (let i = 0; i < 20 * 10; i++) {
        rec.tick(1);
        const m = sim.arenaMatchFor(pids[0]);
        if (m && m.state === 'active') break;
      }
      const match = sim.arenaMatchFor(pids[0]);
      if (match && match.fiesta && match.teamA.length && match.teamB.length) {
        const killer = sim.entities.get(match.teamA[0]) as AnyEntity;
        const victim = sim.entities.get(match.teamB[0]) as AnyEntity;
        beef(victim, 5000); // survive the two non-lethal cast-interrupt hits
        // (a) mid-cast pushback: a normal (non-fishing) cast, hit non-lethally.
        victim.castingAbility = 'fireball';
        victim.castRemaining = 2;
        victim.castTotal = 2;
        victim.channeling = false;
        sim.dealDamage(killer, victim, 50, false, 'physical', null, 'hit');
        rec.snapshot('midcast-pushback');
        // (b) mid-cast fishing cancel: the fishing cast is cancelled, not pushed.
        victim.castingAbility = FISHING_CAST_ID;
        victim.castRemaining = 5;
        victim.channeling = false;
        sim.dealDamage(killer, victim, 50, false, 'physical', null, 'hit');
        rec.snapshot('midcast-fishcancel');
        // (c) lethal cross-team hit: hp=0 -> emit damage -> fiestaTakedown -> return.
        victim.castingAbility = 'fireball';
        victim.castRemaining = 2;
        victim.castTotal = 2;
        victim.channeling = false;
        sim.dealDamage(killer, victim, victim.maxHp + 50, false, 'physical', null, 'hit');
        rec.notes.fiestaVictimPid = victim.id;
        rec.notes.fiestaKillerPid = killer.id;
        rec.snapshot('takedown');
        rec.tick(1);
      }
      rec.tick(20 * 2);
    },
  };
}

// Quest kill-credit (Q1): accept a kill quest at its giver NPC (driving
// finalizeQuestAccept's onInventoryChangedForQuests), then slay the target mob one
// at a time so handleDeath's party-credit loop fires onMobKilledForQuests (counts++
// + questProgress) until checkQuestReady promotes active -> ready; finally turn the
// quest in at the NPC for its xp + copper. Pins the quest-credit trio's kill path and
// the promotion arm of checkQuestReady.
function questKillCredit(): Scenario {
  return {
    name: 'quest_kill_credit',
    coverage: [
      'onMobKilledForQuests kill credit via handleDeath party loop (~5925)',
      'checkQuestReady promotion (active -> ready)',
      'acceptQuest -> finalizeQuestAccept -> onInventoryChangedForQuests',
      'turnInQuest (xp + copper reward)',
    ],
    build: () => new Sim({ seed: 1014, playerClass: 'warrior', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      sim.setPlayerLevel(10);
      const p = sim.player as AnyEntity;
      beef(p);
      const quest = QUESTS.q_wolves;
      // Accept at the giver NPC (marshal_redbrook): exercises finalizeQuestAccept's
      // onInventoryChangedForQuests foreign call.
      const giver = [...sim.entities.values()].find(
        (e: AnyEntity) => e.kind === 'npc' && e.templateId === quest.giverNpcId,
      ) as AnyEntity | undefined;
      if (giver) teleport(sim, p, giver.pos.x, giver.pos.z);
      sim.acceptQuest('q_wolves', sim.playerId);
      rec.snapshot('quest-accepted');
      // Slay each Forest Wolf one at a time (only one alive, so frenzyPackmates finds
      // no living packmate), crediting the player on every death.
      const need = quest.objectives[0].count; // 8
      for (let i = 0; i < need; i++) {
        const wolf = spawnMob(sim, 'forest_wolf', 2, p.pos.x + 2, p.pos.y, p.pos.z);
        wolf.tappedById = p.id;
        lethal(sim, p, wolf);
        rec.tick(1); // flush the kill's credit events; sample progress
      }
      rec.snapshot('quest-ready');
      // Turn in at the NPC (giver is also the turn-in for q_wolves).
      if (giver) teleport(sim, p, giver.pos.x, giver.pos.z);
      sim.turnInQuest('q_wolves', sim.playerId);
      rec.snapshot('quest-turned-in');
      rec.tick(2);
    },
  };
}

// C1 damage core: multiple classes wound a frenzyOnHit mob so maybeFrenzyOnHit (the
// ONLY rng draw in this slice) fires once per qualifying hit, pinning that draw at
// its global stream position. The frenzy chance is forced to 1 (the draw still
// happens; it just makes the blood_frenzy buff land deterministically so the push +
// refresh branches both run) and restored afterward (MOBS is a process-wide
// singleton). dealDamage is called directly per class source.
function multiClassFrenzy(): Scenario {
  return {
    name: 'multi_class_frenzy',
    coverage: [
      'dealDamage -> maybeFrenzyOnHit rng draw (the only in-slice draw, ~5651/5702)',
      'blood_frenzy push then refresh branches',
      'amp stack + threat handoff + tap rights across multiple attackers',
      'multi-class sources: warrior/mage/rogue',
    ],
    sampleEvery: 5,
    build: () => new Sim({ seed: 1015, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const classes: Array<'warrior' | 'mage' | 'rogue'> = ['warrior', 'mage', 'rogue'];
      const pids = classes.map((c, i) => sim.addPlayer(c, `M${i}`));
      pids.forEach((pid, i) => {
        const e = sim.entities.get(pid) as AnyEntity;
        teleport(sim, e, i * 2, -30);
        beef(e); // keep every attacker alive while the mob swings back
      });
      const lead = sim.entities.get(pids[0]) as AnyEntity;
      const greyjaw = spawnMob(sim, 'old_greyjaw', 6, lead.pos.x + 1, lead.pos.y, lead.pos.z + 2);
      beef(greyjaw, 200000);
      greyjaw.hostile = true;
      rec.track(greyjaw.id);
      rec.notes.greyjawId = greyjaw.id;

      const greyTrait = MOBS.old_greyjaw.frenzyOnHit;
      const greyOrig = greyTrait ? greyTrait.chance : undefined;
      try {
        if (greyTrait) greyTrait.chance = 1;
        for (let round = 0; round < 4; round++) {
          for (const pid of pids) {
            const e = sim.entities.get(pid) as AnyEntity;
            sim.dealDamage(e, greyjaw, 30, false, 'physical', null, 'hit');
          }
          rec.snapshot(`frenzy-round-${round}`);
        }
      } finally {
        if (greyTrait && greyOrig !== undefined) greyTrait.chance = greyOrig;
      }
      rec.tick(10);
    },
  };
}

// Mob target selection + threat switching (M1): the per-tick target picker and the
// threat-switch rules that decide which player a mob hits and when a taunt or
// pull-over forces a swap. Drives updateMobTarget through the 110% melee and 130%
// ranged pull-over branches (plus the strict-boundary no-switch), the forced-target/
// taunt branch and its forcedTargetTimer expiry, then retargetMob through both the
// highest-threat pick and the prune-to-evade path (which also exercises the two new
// Nythraxis-add seam callbacks via a non-add mob, where they no-op). One hostile mob
// and three players each hold different threat; the mob + players are tracked so
// aggroTargetId, the threat table, forcedTargetTimer/Id, and aiState are pinned every
// snapshot. The four methods draw no rng, so this scenario pins their STATE decisions
// (the surrounding mob-AI draw order is already pinned by affix_mob / the solo runs).
function mobTargeting(): Scenario {
  return {
    name: 'mob_targeting',
    coverage: [
      'updateMobTarget 110% melee pull-over (MELEE_SWITCH_MULT, inMelee MELEE_RANGE*1.2)',
      'updateMobTarget 130% ranged pull-over (RANGED_SWITCH_MULT) + strict-boundary no-switch',
      'forced-target/taunt branch + forcedTargetTimer -= DT expiry + forcedTargetId clear',
      'retargetMob highest-threat pick + prune-to-evade (highestThreatTarget delete-during-iterate)',
      'nythraxisAddFallbackTarget / scheduleNythraxisAddDespawnIfBossReset seam callbacks (non-add -> no-op)',
    ],
    sampleEvery: 2,
    build: () => new Sim({ seed: 1014, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const tankId = sim.addPlayer('warrior', 'Tank');
      const bruiserId = sim.addPlayer('rogue', 'Bruiser');
      const casterId = sim.addPlayer('mage', 'Caster');
      const tank = sim.entities.get(tankId) as AnyEntity;
      const bruiser = sim.entities.get(bruiserId) as AnyEntity;
      const caster = sim.entities.get(casterId) as AnyEntity;
      beef(tank);
      beef(bruiser);
      beef(caster);
      const mob = spawnMob(sim, 'forest_wolf', 5, 0, terrainHeight(0, 0, sim.cfg.seed), 0);
      beef(mob, 50000);
      mob.hostile = true;
      rec.track(mob.id, tankId, bruiserId, casterId);
      rec.notes.mobId = mob.id;
      rec.notes.tankId = tankId;
      rec.notes.bruiserId = bruiserId;
      rec.notes.casterId = casterId;
      // tank + bruiser inside MELEE_RANGE*1.2 (=6) of the mob; caster well outside.
      teleport(sim, tank, 2, 0);
      teleport(sim, bruiser, -2, 0);
      teleport(sim, caster, 0, 20);

      // Baseline: mob on the tank (highest threat); no one is over a switch threshold.
      mob.threat.set(tankId, 100);
      mob.threat.set(bruiserId, 50);
      mob.threat.set(casterId, 50);
      mob.aggroTargetId = tankId;
      mob.aiState = 'attack';
      mob.inCombat = true;
      (sim as any).updateMobTarget(mob);
      rec.snapshot('baseline-tank');

      // 110% melee pull-over: bruiser (in melee) crosses 110% of the tank's 100.
      mob.threat.set(bruiserId, 120);
      (sim as any).updateMobTarget(mob);
      rec.notes.afterMelee = mob.aggroTargetId;
      rec.snapshot('melee-pullover');

      // Ranged strict boundary: caster at EXACTLY 130% does NOT pull (strict `>`).
      mob.aggroTargetId = tankId;
      mob.threat.set(bruiserId, 50);
      mob.threat.set(casterId, 130);
      (sim as any).updateMobTarget(mob);
      rec.notes.afterRangedBoundary = mob.aggroTargetId;
      rec.snapshot('ranged-boundary-no-switch');

      // 130% ranged pull-over: caster (out of melee) crosses 130% of the tank's 100.
      mob.aggroTargetId = tankId;
      mob.threat.set(casterId, 140);
      (sim as any).updateMobTarget(mob);
      rec.notes.afterRanged = mob.aggroTargetId;
      rec.snapshot('ranged-pullover');

      // Forced-target/taunt branch: lock the mob onto the tank despite the caster's
      // higher threat. The branch decrements the timer and early-returns first.
      mob.aggroTargetId = casterId;
      mob.forcedTargetId = tankId;
      mob.forcedTargetTimer = 3;
      (sim as any).updateMobTarget(mob);
      rec.notes.afterTauntForced = mob.aggroTargetId;
      rec.snapshot('taunt-forced');

      // Timer about to expire: this call still honors the forced target (returns
      // before the clear), but the `-= DT` drives forcedTargetTimer negative.
      mob.forcedTargetTimer = DT / 2;
      (sim as any).updateMobTarget(mob);
      rec.snapshot('taunt-decrement');

      // Timer expired: forcedTargetId clears and the threat scan reclaims the caster.
      (sim as any).updateMobTarget(mob);
      rec.notes.afterTauntExpired = mob.aggroTargetId;
      rec.snapshot('taunt-expired');

      // retargetMob: with living threat it grabs the highest (caster) and chases.
      (sim as any).retargetMob(mob);
      rec.notes.afterRetarget = mob.aggroTargetId;
      rec.snapshot('retarget-highest');

      // retargetMob with only stale (missing-entity) threat: highestThreatTarget
      // prunes every entry mid-iterate -> no living target -> (non-add, so both
      // Nythraxis seam callbacks no-op) -> evade home with an empty threat table.
      mob.threat.clear();
      mob.threat.set(900001, 30);
      mob.threat.set(900002, 10);
      mob.aggroTargetId = casterId;
      mob.aiState = 'chase';
      (sim as any).retargetMob(mob);
      rec.notes.finalAiState = mob.aiState;
      rec.snapshot('retarget-evade');
    },
  };
}

// Quest collect-credit + turn-in (Q1): accept a collect quest at its NPC, gather the
// objective item one at a time so each addItem drives onInventoryChangedForQuests
// (counts++ + questProgress) until checkQuestReady promotes active -> ready; then drop
// one item so removeItem demotes ready -> active (the demotion arm), re-collect it, and
// finally turn the quest in (turnInQuest's removeItem re-fires onInventoryChangedForQuests
// before granting xp + copper). Pins the collect path and BOTH arms of checkQuestReady.
function questCollectTurnIn(): Scenario {
  return {
    name: 'quest_collect_turnin',
    coverage: [
      'onInventoryChangedForQuests via addItem/removeItem inventory hub (~9782/9800)',
      'checkQuestReady promotion AND demotion (ready <-> active)',
      'acceptQuest -> finalizeQuestAccept -> onInventoryChangedForQuests',
      'turnInQuest -> removeItem -> onInventoryChangedForQuests (xp + copper)',
    ],
    build: () => new Sim({ seed: 1015, playerClass: 'warrior', autoEquip: false }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const p = sim.player as AnyEntity;
      const quest = QUESTS.q_boars;
      const item = quest.objectives[0].itemId as string; // boar_hide
      const need = quest.objectives[0].count; // 5
      const npc = [...sim.entities.values()].find(
        (e: AnyEntity) => e.kind === 'npc' && e.templateId === quest.giverNpcId,
      ) as AnyEntity | undefined;
      if (npc) teleport(sim, p, npc.pos.x, npc.pos.z);
      sim.acceptQuest('q_boars', sim.playerId);
      rec.snapshot('quest-accepted');
      // Collect to completion, one hide at a time: each addItem drives the inventory
      // hub -> onInventoryChangedForQuests; the last one promotes the quest to ready.
      for (let i = 0; i < need; i++) {
        sim.addItem(item, 1, sim.playerId);
      }
      rec.snapshot('collect-ready');
      // Demotion arm: drop one hide -> onInventoryChangedForQuests recomputes have < count
      // -> checkQuestReady demotes ready -> active.
      sim.removeItem(item, 1, sim.playerId);
      rec.snapshot('collect-demoted');
      // Re-collect the dropped hide -> ready again.
      sim.addItem(item, 1, sim.playerId);
      rec.snapshot('collect-re-ready');
      // Turn in at the NPC: turnInQuest removes the collected items (re-firing
      // onInventoryChangedForQuests) then grants xp + copper.
      if (npc) teleport(sim, p, npc.pos.x, npc.pos.z);
      sim.turnInQuest('q_boars', sim.playerId);
      rec.snapshot('quest-turned-in');
      rec.tick(2);
    },
  };
}

// Party/raid state machine (A1): the full social flow, which draws NO rng of its
// own. Forms a party of five, converts it to a raid, fills to a second subgroup,
// moves a member across groups, then hands off leadership and drains the roster to
// a disband. Pins the party emit stream (invite + join/convert/move/leave/handoff/
// disband logs) in order; partyOf must keep resolving after the move. The draw-order
// digest must stay byte-identical (this slice never touches rng), so any drift means
// a surrounding draw shifted.
function partyRaid(): Scenario {
  return {
    name: 'party_raid',
    coverage: [
      'partyInvite/partyAccept party formation (~11864/11901)',
      'convertPartyToRaid full-party gate (RAID_MIN) + normalizeRaidGroups',
      'raid fill to two subgroups (nextRaidGroupFor) + moveRaidMember (RAID_GROUP_MAX)',
      'removeFromParty leadership handoff + disband + partyOf via SimContext',
    ],
    build: () => new Sim({ seed: 1014, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const a = sim.addPlayer('warrior', 'Aaa');
      const b = sim.addPlayer('mage', 'Bbb');
      const c = sim.addPlayer('rogue', 'Ccc');
      const d = sim.addPlayer('hunter', 'Ddd');
      const e = sim.addPlayer('warlock', 'Eee');
      const f = sim.addPlayer('paladin', 'Fff');
      const g = sim.addPlayer('warrior', 'Ggg');
      rec.track(a, b, c, d, e, f, g);
      // 1) a invites four; each accepts -> a full party of five.
      for (const m of [b, c, d, e]) {
        sim.partyInvite(m, a);
        sim.partyAccept(m);
      }
      rec.snapshot('party-of-5');
      // 2) convert the full party to a raid (requires RAID_MIN members).
      sim.convertPartyToRaid(a);
      rec.snapshot('raid');
      // 3) invite two more; subgroup 1 is full (5) so they land in subgroup 2.
      for (const m of [f, g]) {
        sim.partyInvite(m, a);
        sim.partyAccept(m);
      }
      rec.snapshot('raid-of-7');
      // 4) move a subgroup-1 member into subgroup 2.
      sim.moveRaidMember(b, 2, a);
      rec.snapshot('moved');
      // 5) the leader leaves -> leadership hands off to the first remaining member.
      sim.partyLeave(a);
      rec.snapshot('leader-left');
      // 6) drain the rest; the last departure triggers the disband branch.
      for (const m of [c, d, e, f, g]) sim.partyLeave(m);
      rec.snapshot('disband');
    },
  };
}

// Talent application (G1a): exercise every sim-side talent method (applyTalents /
// respec / saveLoadout + switchLoadout / setSpec) on a max-level warrior so the flat
// `talentMods` struct re-bakes and the known-ability list flips on each change. Drives
// NO rng (talent application is deterministic validation + struct baking), so the draw
// digest stays empty/byte-identical across the extraction. Pure snapshots, no ticks, so
// the player never enters combat and the talent-lock guard never trips.
function talentsProgression(): Scenario {
  return {
    name: 'talents_progression',
    coverage: [
      'applyTalents valid spec build (G1a) + recomputeTalents flat-struct bake',
      'respec wipes ranks, keeps spec',
      'saveLoadout (object-alloc overload) + switchLoadout (2 of 4 slots)',
      'setSpec drops the prior spec tree points',
      'refreshKnownAbilities(announce=false): known-ability list flips per change',
    ],
    sampleEvery: 2,
    build: () => new Sim({ seed: 1014, playerClass: 'warrior', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      sim.setPlayerLevel(MAX_LEVEL); // enough talent points for a spec'd build
      // (1) Apply a valid Arms build: the flat talentMods bakes + known list changes.
      sim.applyTalents({ spec: 'arms', ranks: { war_cruelty: 2, arms_imp_overpower: 2 }, choices: {} });
      rec.snapshot('apply-arms');
      // (2) Respec: ranks wiped, spec retained, stats revert.
      sim.respec();
      rec.snapshot('respec');
      // (3) Save the respec'd build as a loadout (the HUD positional-alloc overload),
      // apply a different build, then switch back to slot 0.
      sim.saveLoadout('Arms', ['mortal_strike', 'overpower', null], {
        spec: 'arms',
        ranks: { arms_imp_overpower: 2 },
        choices: {},
      });
      sim.applyTalents({ spec: 'arms', ranks: { war_cruelty: 3 }, choices: {} });
      rec.snapshot('second-build');
      sim.switchLoadout(0);
      rec.snapshot('switch-loadout');
      // (4) Set spec to Fury: the prior (Arms) spec tree's points drop; class points stay.
      sim.setSpec('fury');
      rec.snapshot('set-spec');
    },
  };
}

// C2 heal core: a healer of every class that owns a heal (priest/paladin/druid/
// shaman) heals a damaged tank while three hostile mobs hold threat on it, so BOTH
// the heal math (crit branch via the rng.chance(spellCrit) draw, overheal clamp,
// Weakening-Hex outgoing cut, Mortal-Wound incoming cut, heal-absorb soak with the
// depleted/survived split) AND the healingThreat fan-out (split evenly across the
// aware mobs, including the pet-owner threat-entry branch) land in the sampled
// trace. The four direct applyHeal calls are the verbatim heal core; the closing
// druid HoT exercises the aura-tick foreign callers (healingTakenMult + healingThreat
// off the `hot` branch), and a forced crit on a critvuln+hexed target exercises the
// dealDamage consumers of critVulnBonus/hexOutputMult. Forced crits boost the source's
// int so rng.chance(spellCrit) is certain to pass (the draw STILL fires, so the
// draw-order log stays meaningful); int is restored immediately. The existing four
// solo/mob scenarios never build a heal or a healing-threat table (parity CLAUDE.md
// "Known coverage gaps"), so this is the only scenario that pins heal drift.
function aura(spec: {
  id: string;
  name: string;
  kind: Aura['kind'];
  value: number;
  sourceId: number;
  duration?: number;
  tickInterval?: number;
}): Aura {
  const duration = spec.duration ?? 60;
  return {
    id: spec.id,
    name: spec.name,
    kind: spec.kind,
    remaining: duration,
    duration,
    value: spec.value,
    sourceId: spec.sourceId,
    school: 'physical',
    ...(spec.tickInterval !== undefined ? { tickInterval: spec.tickInterval } : {}),
  } as Aura;
}

function multiClassHeal(): Scenario {
  return {
    name: 'multi_class_heal',
    coverage: [
      'applyHeal core: crit branch (rng.chance(spellCrit) draw), overheal clamp, heal2 emit',
      'hexOutputMult outgoing cut (hex on source) + healingTakenMult Mortal-Wound cut (target)',
      'consumeHealAbsorb soak: small shield depletes+filters, big shield survives',
      'healingThreat even split across multiple aware mobs (entities.values insertion order)',
      'threatEntryMatchesEntity direct-target + pet-owner branches',
      'hot aura-tick heal path (healingTakenMult ~3089 + healingThreat ~3101)',
      'dealDamage consumers: critVulnBonus (crit-only) + hexOutputMult on a damage hit',
      'multi-class healers: priest/paladin/druid/shaman',
    ],
    sampleEvery: 5,
    build: () => new Sim({ seed: 1016, playerClass: 'priest', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      // Four healers, each a class that owns a heal.
      const priest = sim.addPlayer('priest', 'Pr') as number;
      const paladin = sim.addPlayer('paladin', 'Pa') as number;
      const druid = sim.addPlayer('druid', 'Dr') as number;
      const shaman = sim.addPlayer('shaman', 'Sh') as number;
      const healerIds = [priest, paladin, druid, shaman];
      healerIds.forEach((pid, i) => teleport(sim, sim.entities.get(pid) as AnyEntity, i * 3, -30));
      const ePriest = sim.entities.get(priest) as AnyEntity;
      const ePaladin = sim.entities.get(paladin) as AnyEntity;
      const eDruid = sim.entities.get(druid) as AnyEntity;
      const eShaman = sim.entities.get(shaman) as AnyEntity;

      // The damaged friendly the healers heal (a player, so it is sampled by default).
      const tankPid = sim.addPlayer('warrior', 'Tk') as number;
      const tank = sim.entities.get(tankPid) as AnyEntity;
      teleport(sim, tank, 30, -30);
      beef(tank, 10000);

      // A pet owned by the tank, so a mob holding threat on the PET (not the tank
      // directly) still counts the tank as aware via threatEntryMatchesEntity's
      // owner branch. Friendly + no threat of its own, so it is never an aware mob.
      const pet = spawnMob(sim, 'forest_wolf', 5, 80, tank.pos.y, 80);
      pet.ownerId = tankPid;
      pet.hostile = false;
      pet.inCombat = false;

      // Three hostile mobs in combat on the tank, far enough that they do not engage
      // within the short HoT tick window. m1/m2 hold the tank directly; m3 holds the
      // tank's pet (the owner branch). Threat is seeded directly so the split is
      // deterministic and re-derivable for QA.
      const m1 = spawnMob(sim, 'forest_wolf', 5, 90, tank.pos.y, 90);
      const m2 = spawnMob(sim, 'forest_wolf', 5, -90, tank.pos.y, 90);
      const m3 = spawnMob(sim, 'forest_wolf', 5, 90, tank.pos.y, -90);
      for (const m of [m1, m2, m3]) {
        beef(m, 50000);
        m.hostile = true;
        m.inCombat = true;
        m.aiState = 'idle';
      }
      m1.threat.set(tankPid, 10);
      m2.threat.set(tankPid, 10);
      m3.threat.set(pet.id, 10); // owner branch: pet in m3's hate table
      rec.track(m1.id, m2.id, m3.id, pet.id);
      rec.notes.healerIds = healerIds;
      rec.notes.tankPid = tankPid;
      rec.notes.m1Id = m1.id;
      rec.notes.m2Id = m2.id;
      rec.notes.m3Id = m3.id;
      rec.notes.petId = pet.id;
      rec.notes.hotAbility = 'Rejuvenation';

      // Force a crit by boosting int so spellCrit(source) >= 1: rng.chance STILL
      // draws (next() < p), it just always passes, so the *1.5 crit path lands in
      // the golden deterministically. Restored immediately after the heal.
      const forcedHeal = (
        e: AnyEntity,
        source: number,
        amount: number,
        ability: string,
      ): void => {
        const int0 = e.stats.int;
        e.stats.int = 5000;
        (sim as any).applyHeal(sim.entities.get(source) as AnyEntity, tank, amount, ability);
        e.stats.int = int0;
      };

      // Heal 1: priest, plain (no mults), tank damaged -> split across all 3 mobs.
      tank.hp = 2000;
      (sim as any).applyHeal(ePriest, tank, 600, 'Heal');

      // Heal 2: paladin, forced crit (no mults) -> *1.5 path.
      tank.hp = 2000;
      forcedHeal(ePaladin, paladin, 800, 'Holy Light');

      // Heal 3: druid, hex on source (outgoing cut) + Mortal-Wound on target
      // (incoming cut), forced crit -> crit*hex*mortal combined.
      eDruid.auras.push(aura({ id: 'hex_dr', name: 'Weakening Hex', kind: 'hex', value: 0.3, sourceId: m1.id }));
      tank.auras.push(aura({ id: 'mw_tk', name: 'Mortal Wound', kind: 'mortal_wound', value: 0.5, sourceId: m1.id }));
      tank.hp = 2000;
      forcedHeal(eDruid, druid, 1000, 'Healing Touch');
      tank.auras = tank.auras.filter((a: Aura) => a.kind !== 'mortal_wound');

      // Heal 4: shaman, two heal-absorb shields -> the small one depletes and is
      // filtered out, the big one survives with reduced budget.
      tank.auras.push(aura({ id: 'absorb_small', name: 'Necrotic', kind: 'heal_absorb', value: 200, sourceId: m1.id }));
      tank.auras.push(aura({ id: 'absorb_big', name: 'Necrotic', kind: 'heal_absorb', value: 5000, sourceId: m1.id }));
      tank.hp = 2000;
      (sim as any).applyHeal(eShaman, tank, 1000, 'Healing Wave');

      // Heal 5: overheal -> healed clamps to 0 -> healingThreat healed<=0 early bail.
      tank.hp = tank.maxHp;
      (sim as any).applyHeal(ePriest, tank, 500, 'Heal');

      // Heal 6: aware.length===0 early bail (target with no mob holding threat on it).
      ePaladin.hp = Math.max(1, ePaladin.maxHp - 200);
      (sim as any).applyHeal(ePriest, ePaladin, 300, 'Heal');
      // One checkpoint pins the cumulative result of all six heals (per-heal amount +
      // crit are folded into this window's event digest; the draw-order log + tank/mob
      // threat tables are pinned in the frame body).
      rec.snapshot('heals');

      // dealDamage consumers: druid (still hexed) crit-hits a critvuln mob ->
      // hexOutputMult (outgoing-damage cut) + critVulnBonus (crit-only) both read.
      m1.auras.push(aura({ id: 'cv_m1', name: 'Find Weakness', kind: 'critvuln', value: 0.5, sourceId: druid }));
      sim.dealDamage(eDruid, m1, 100, true, 'physical', 'Smite', 'hit');
      rec.snapshot('crit-vuln-damage');

      // HoT path: a druid Rejuvenation on the tank ticks through the `hot` aura
      // branch -> healingTakenMult(~3089) + healingThreat(~3101) foreign callers.
      // (The surviving absorb_big rides along untouched: the hot branch never calls
      // consumeHealAbsorb, only applyHeal does.)
      tank.hp = 2000;
      tank.auras.push(
        aura({ id: 'hot_tk', name: 'Rejuvenation', kind: 'hot', value: 300, sourceId: druid, duration: 3, tickInterval: 0.1 }),
      );
      rec.tick(8); // ~4 HoT ticks; finish() pins the end state + folded HoT events
    },
  };
}

// Mob locomotion (M2): the updateMob dispatcher's boss-mechanic attack arms plus the
// idle-wander, evade-arrival, and cowardly-flee states. Each is driven DIRECTLY through
// updateMob (exactly as the mob_* unit tests do; the extraction keeps a thin Sim
// delegate) so the rng draws INSIDE the moved arms are pinned at fixed stream positions:
// aoePulse rng.range(min,max), War Stomp rng.range(min,max), Banshee terrify
// rng.range(-PI,PI), the idle wander heading/radius draws, and resetEvadingMob's
// rng.range(2,8). The flee path (maybeFlee at FLEE_HP_THRESHOLD -> flee arm) draws no
// rng but pins its full-state transition. The four mechanic mobs sit on the player in
// melee (spawnPos == player pos, so no leash); the wanderer/evader sit far out of aggro
// range. None of these mobs is profiled, so the attack arm reaches every mechanic.
function mobLocomotion(): Scenario {
  return {
    name: 'mob_locomotion',
    coverage: [
      'attack arm aoePulse rng.range(pulse.min,pulse.max) + spellfx (mogger Ground Pound)',
      'attack arm War Stomp rng.range(stomp.min,stomp.max) + stomp_stun aura (korgath)',
      'attack arm Banshee terrify rng.range(-PI,PI) fear facing + fear_incap aura (sister_nhalia)',
      'idle arm wander draws (range(0,2PI) heading + range(2,9) radius -> groundPos wanderTarget)',
      'evade arm arrival -> resetEvadingMob (rng.range(2,8), full-heal, clearThreat, telegraph re-arm)',
      'cowardly flee: maybeFlee at FLEE_HP_THRESHOLD -> flee arm (fleeMoveSpeed run-away)',
    ],
    sampleEvery: 1,
    build: () => new Sim({ seed: 7777, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const pid = sim.addPlayer('warrior', 'Anvil');
      const player = sim.entities.get(pid) as AnyEntity;
      rec.track(pid);
      rec.notes.pid = pid;
      // Keep the target alive through every mechanic. beef() on a player does not
      // stick: applyAura -> recalcPlayerStats resets maxHp to the real (level-1)
      // value, so each boss aura would otherwise shrink maxHp and the next mechanic
      // would kill the player. recalc clamps only at the aura-apply point (at/after
      // the draw), so a fresh top-up right before each call keeps every draw firing.
      const reviveTarget = () => {
        player.hp = 1_000_000;
      };

      // Spawn a boss locked in melee on the player (spawnPos == player pos -> no leash),
      // arm its mechanic timer to fire now, then tick its AI once so the mechanic lands.
      const fireMechanic = (key: string, level: number, arm: (m: AnyEntity) => void): AnyEntity => {
        const m = spawnMob(sim, key, level, player.pos.x, player.pos.y, player.pos.z);
        m.spawnPos = { ...player.pos };
        m.aiState = 'attack';
        m.aggroTargetId = pid;
        m.inCombat = true;
        m.hostile = true;
        arm(m);
        reviveTarget();
        rec.track(m.id);
        (sim as any).updateMob(m);
        return m;
      };

      // aoePulse: Ground Pound draws rng.range(14,20) per player in radius.
      const pulser = fireMechanic('mogger', 6, (m) => {
        m.pulseTimer = 0.001;
      });
      rec.notes.pulserId = pulser.id;
      rec.snapshot('aoe-pulse');

      // War Stomp: draws rng.range(20,30) + lands a stomp_stun aura on the player.
      const stomper = fireMechanic('korgath_the_bound', 20, (m) => {
        m.stompTimer = 0.001;
      });
      rec.notes.stomperId = stomper.id;
      rec.notes.stompStunLanded = player.auras.some((a: any) => a.id === 'stomp_stun');
      rec.snapshot('war-stomp');

      // Banshee terrify: draws rng.range(-PI,PI) for the fear facing + fear_incap aura.
      const terrifier = fireMechanic('sister_nhalia', 12, (m) => {
        m.terrifyTimer = 0.001;
      });
      rec.notes.terrifierId = terrifier.id;
      rec.notes.fearLanded = player.auras.some((a: any) => a.id === 'fear_incap');
      rec.snapshot('terrify');

      // Idle wander: a mob far out of aggro range whose wanderTimer is due picks a new
      // wander target (rng.range(0,2PI) heading + rng.range(2,9) radius -> groundPos).
      const wanderer = spawnMob(sim, 'forest_wolf', 5, 300, terrainHeight(300, 300, sim.cfg.seed), 300);
      wanderer.aiState = 'idle';
      wanderer.wanderTarget = null;
      wanderer.wanderTimer = 0.001;
      rec.track(wanderer.id);
      (sim as any).updateMob(wanderer);
      rec.notes.wandererId = wanderer.id;
      rec.snapshot('idle-wander');

      // Evade arrival: a mob already at its spawn in the evade state arrives immediately
      // (moveToward returns true at dist 0) -> resetEvadingMob (rng.range(2,8) wanderTimer,
      // hp -> maxHp, threat cleared, telegraph timers re-armed).
      const evader = spawnMob(sim, 'forest_wolf', 5, 320, terrainHeight(320, 320, sim.cfg.seed), 320);
      evader.aiState = 'evade';
      evader.hp = 1;
      evader.inCombat = true;
      evader.threat.set(pid, 50);
      rec.track(evader.id);
      (sim as any).updateMob(evader);
      rec.notes.evaderHp = evader.hp;
      rec.notes.evaderState = evader.aiState;
      rec.snapshot('evade-reset');

      // Cowardly flee: a low-HP humanoid in melee panics once (maybeFlee at/under
      // FLEE_HP_THRESHOLD -> aiState 'flee'), then the flee arm runs it away. The
      // 'attempts to flee!' emit + callForHelp stay on Sim; the flee arm draws no rng.
      const coward = spawnMob(sim, 'mogger_lackey', 6, player.pos.x + 1, player.pos.y, player.pos.z + 1);
      coward.spawnPos = { ...coward.pos };
      coward.aiState = 'attack';
      coward.aggroTargetId = pid;
      coward.inCombat = true;
      coward.hostile = true;
      coward.hp = Math.max(1, Math.floor(coward.maxHp * 0.15)); // <= FLEE_HP_THRESHOLD (0.2)
      rec.track(coward.id);
      reviveTarget(); // the lackey needs a living target to panic away from
      (sim as any).updateMob(coward); // attack arm -> maybeFlee triggers the flee
      rec.notes.cowardStateAfterPanic = coward.aiState;
      rec.snapshot('flee-panic');
      reviveTarget();
      (sim as any).updateMob(coward); // flee arm: fleeMoveSpeed + run away from the player
      rec.notes.cowardStateFleeing = coward.aiState;
      rec.snapshot('flee-run');
    },
  };
}

// Delve run progression (I2a): the multi-module run lifecycle the existing
// delve_lockpick golden skips (it pins straight to the finale). Pins a two-module
// run (one non-finale chamber + the finale), clears the chamber (mobs down +
// pressure plates stepped), walks the opened tombstone exit so advanceDelveModule
// rolls onto the finale, then buys at the Marks shop (delveBuyShopItem gate +
// addItem), upgrades the companion (Marks/copper spend), and rolls the UTC day so
// refreshDelveDaily resets firstClearXp/markClears. Covers spawnDelveModule(x2),
// tickDelvePressurePlates, tryOpen/openDelveExitPortal, findDelveExitPortal,
// tickDelveModuleExit, advanceDelveModule, the shop, and the daily reset, none of
// which the finale-only delve_lockpick scenario exercises.
function delveProgression(): Scenario {
  return {
    name: 'delve_progression',
    coverage: [
      'multi-module delve: spawnDelveModule(non-finale) -> clear -> advanceDelveModule',
      'tickDelvePressurePlates + exit portal open + tombstone advance',
      'Marks shop buy (delveBuyShopItem gate + addItem + vendor)',
      'companionUpgrade rank bump + refreshDelveDaily day rollover',
    ],
    sampleEvery: 5,
    build: () => new Sim({ seed: 2010, playerClass: 'warrior', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const def = DELVES.collapsed_reliquary;
      sim.setPlayerLevel(def.minLevel);
      const p = sim.player as AnyEntity;
      beef(p);
      teleport(sim, p, def.doorPos.x, def.doorPos.z);
      sim.enterDelve('collapsed_reliquary', 'normal');
      const run = sim.delveRunForPlayer(sim.playerId);
      if (!run) {
        rec.tick(2);
        return;
      }
      run.bountiful = false; // pin against the rare coffer roll
      // Pin a two-module run: one non-finale chamber, then the finale.
      const nonFinale = def.modules.find((m: string) => m !== def.finaleModuleId) as string;
      run.modules = [nonFinale, def.finaleModuleId];
      run.moduleIndex = 0;
      (sim as any).spawnDelveModule(run);
      // Clear the chamber: down every spawned mob, then step every pressure plate
      // through the real tickDelvePressurePlates path (teleport onto the plate).
      for (const id of [...run.mobIds]) {
        const m = sim.entities.get(id) as AnyEntity | undefined;
        if (m) m.dead = true;
      }
      for (const oid of [...run.objectIds]) {
        if (run.objectState[oid]?.kind !== 'pressure_plate') continue;
        const plate = sim.entities.get(oid) as AnyEntity | undefined;
        if (!plate) continue;
        p.pos = { x: plate.pos.x, y: plate.pos.y, z: plate.pos.z };
        p.prevPos = { ...p.pos };
        sim.rebucket(p);
        rec.tick(1); // tickDelvePressurePlates triggers this plate
      }
      rec.tick(2); // all mobs dead + plates triggered -> exit portal opens
      const portal = [...sim.entities.values()].find(
        (e: AnyEntity) => run.objectState[e.id]?.kind === 'module_exit',
      ) as AnyEntity | undefined;
      if (portal) {
        p.pos = { x: portal.pos.x, y: portal.pos.y, z: portal.pos.z };
        p.prevPos = { ...p.pos };
        sim.rebucket(p);
        rec.tick(3); // walk into the tombstone -> advanceDelveModule to the finale
      }
      rec.snapshot('advanced-to-finale');
      // Marks shop: an 'available'-gated piece + a companion rank bump.
      const meta = sim.players.get(sim.playerId) as any;
      meta.delveMarks = 100;
      meta.copper = 100000;
      sim.delveBuyShopItem('collapsed_reliquary', 'reliquary_legs');
      sim.companionUpgrade('companion_tessa');
      // Daily rollover: a fresh UTC day resets firstClearXp/markClears.
      meta.delveDaily = { date: '2099-01-01', firstClearXp: new Set(['seed']), markClears: 2 };
      sim.utcDay = '2099-06-25';
      sim.delveDailyWire(sim.playerId);
      rec.snapshot('shop-daily');
      rec.tick(2);
    },
  };
}

// Dungeon instancing (I1): a party walks through the Hollow Crypt door (the
// updateDoorTriggers door-trigger teleport -> enterDungeon -> claimInstance, which
// draws rng.int once per spawn). The second party member walks the same door and
// joins the SAME instance via instanceKeyFor (no re-claim, no rng). Both then walk
// the exit portal back out (updateDoorTriggers exit branch -> leaveDungeon), and
// finally the empty instance resets (updateInstances -> freeInstance despawns the
// mobs/objects/exit and nulls partyKey).
function dungeonInstances(): Scenario {
  return {
    name: 'dungeon_instances',
    coverage: [
      'updateDoorTriggers door-trigger enter (~14612)',
      'enterDungeon -> claimInstance rng.int per spawn (~14774) + addEntity mobs/objects/exit',
      'party shares ONE instance via instanceKeyFor (second member joins, no re-claim)',
      'updateDoorTriggers exit portal -> leaveDungeon (~14620)',
      'updateInstances empty-reset -> freeInstance despawn + partyKey null (~14841/14816)',
    ],
    sampleEvery: 5,
    build: () => new Sim({ seed: 1016, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const a = sim.addPlayer('warrior', 'Aaa');
      const b = sim.addPlayer('mage', 'Bbb');
      sim.partyInvite(b, a);
      sim.partyAccept(b);
      const ea = sim.entities.get(a) as AnyEntity;
      const eb = sim.entities.get(b) as AnyEntity;
      beef(ea);
      beef(eb);
      // Walk player A onto the Hollow Crypt door -> the movement-pass door trigger
      // enters the dungeon and claims a fresh instance (rng.int per spawned mob).
      const door = [...sim.entities.values()].find(
        (e: AnyEntity) => e.templateId === 'dungeon_door' && e.dungeonId === 'hollow_crypt',
      ) as AnyEntity;
      teleport(sim, ea, door.pos.x, door.pos.z);
      rec.tick(1);
      // Player B walks the same door -> same instanceKeyFor -> joins A's instance.
      teleport(sim, eb, door.pos.x, door.pos.z);
      rec.tick(1);
      const inst = (sim.instances as any[]).find(
        (i) => i.dungeonId === 'hollow_crypt' && i.partyKey !== null,
      );
      rec.track(...inst.mobIds, ...inst.objectIds);
      if (inst.exitId != null) rec.track(inst.exitId);
      rec.notes.slotA = sim.instanceSlotAt(ea.pos);
      rec.notes.slotB = sim.instanceSlotAt(eb.pos);
      rec.notes.instMobIds = [...inst.mobIds];
      rec.snapshot('entered');
      // Walk both out via the exit portal (the inside branch of updateDoorTriggers).
      const exit = sim.entities.get(inst.exitId) as AnyEntity;
      teleport(sim, ea, exit.pos.x, exit.pos.z);
      rec.tick(1);
      teleport(sim, eb, exit.pos.x, exit.pos.z);
      rec.tick(1);
      rec.snapshot('left');
      // Reset-when-empty: nobody inside, jump the empty timer past INSTANCE_EMPTY_TIMEOUT
      // (300s) so a single updateInstances cycle (% 20) runs freeInstance.
      inst.emptyFor = 100000;
      rec.tick(20);
      rec.snapshot('reset');
    },
  };
}

// Dungeon raid lockout (I1): a five-strong attuned raid is blocked from re-entering
// the Nythraxis arena by an active raid lockout. Exercises enterDungeon's raid gating
// (convertPartyToRaid + canEnterNythraxisRaid attunement) and the isRaidLocked block
// emitting "You are locked to Nythraxis Raid Arena." (no rng drawn).
function dungeonRaidLockout(): Scenario {
  return {
    name: 'dungeon_raid_lockout',
    coverage: [
      'enterDungeon raid gating: convertPartyToRaid + canEnterNythraxisRaid attunement (~14640)',
      'isRaidLocked active lockout blocks entry (~14706) + locked-to-arena emit',
    ],
    sampleEvery: 10,
    build: () => new Sim({ seed: 1017, playerClass: 'warrior', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const leader = sim.addPlayer('warrior', 'Lead');
      // convertPartyToRaid requires a full party of five.
      while ((sim.partyOf(leader)?.members.length ?? 1) < 5) {
        const pid = sim.addPlayer('priest', `Fill${sim.players.size}`);
        sim.partyInvite(pid, leader);
        sim.partyAccept(pid);
      }
      sim.convertPartyToRaid(leader);
      const meta = sim.players.get(leader) as any;
      meta.questsDone.add('q_nythraxis_bound_guardian'); // attune past the royal-door seal
      meta.raidLockouts.set('nythraxis_boss_arena', 999999999); // active lockout (far future ms)
      rec.snapshot('locked');
      sim.enterDungeon('nythraxis_boss_arena', leader); // blocked by isRaidLocked
      rec.snapshot('lockout-blocked');
      rec.tick(1);
    },
  };
}

// C3 aura/regen runner: the per-tick aura/regen/timer slice that moves to
// src/sim/combat/auras.ts. Three phases pin the pieces other scenarios miss:
//  A. DoT-kills-mid-tick guard: a victim mob carries a buff at index 0 and a lethal
//     dot at index 1. updateAuras walks auras BACKWARD, so the dot ticks first; its
//     dealDamage drops the victim to dead and the `if (e.dead) return;` guard (~3095)
//     short-circuits BEFORE the index-0 aura is reached (handleDeath has already cleared
//     the corpse's auras, so without the guard the loop would walk a mutated list).
//     Reordering or dropping the guard forks the draw order / trace.
//  B. updateRegen eat/drink (the ctx.healingTakenMult seam call + the 'heal' emit) and
//     mana/hp regen, plus a short buff_ap that expires inside updateAuras -> statsDirty
//     -> recalcPlayerStats (player branch) + applyNonPlayerStatAura on expiry.
//  C. A ground AoE pulsing over 2+ hostiles so pulseGroundAoE iterates hostilesInRadius
//     and draws rng.range once per in-radius target in stable order (paladin_consecration
//     only ever has one mob in radius).
function c3AuraRunner(): Scenario {
  return {
    name: 'c3_aura_runner',
    coverage: [
      'updateAuras dot-tick kills target mid-walk -> e.dead guard short-circuits (~3095)',
      'updateAuras aura-expiry statsDirty -> recalcPlayerStats + applyNonPlayerStatAura',
      "updateRegen eat/drink path (ctx.healingTakenMult + 'heal' emit) + out-of-combat regen",
      'pulseGroundAoE over 2+ in-radius hostiles: rng.range per target, stable order',
      'class:paladin',
    ],
    sampleEvery: 5,
    build: () => new Sim({ seed: 1017, playerClass: 'paladin', autoEquip: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      sim.setPlayerLevel(20); // consecration learnLevel 18
      const p = sim.player as AnyEntity;
      beef(p);

      // ----- Phase A: a DoT kills the victim mid-updateAuras (the e.dead guard) -----
      // The buff at index 0 + the lethal dot at index 1: the backward walk ticks the dot
      // first, its dealDamage kills the victim, and the guard returns before index 0 is
      // touched (the rider buff survives intact on the corpse). The dot is sourceless
      // (caster id absent) so the death cascade stays minimal and attributable.
      const ABSENT_SOURCE = 999999;
      const victim = spawnMob(sim, 'forest_wolf', 5, 40, p.pos.y, 40);
      victim.hostile = true;
      victim.auras.push(
        aura({ id: 'rider_buff', name: 'Rider', kind: 'buff_armor', value: 10, sourceId: ABSENT_SOURCE }),
      );
      victim.auras.push(
        aura({ id: 'lethal_dot', name: 'Rupture', kind: 'dot', value: 9999, sourceId: ABSENT_SOURCE, tickInterval: 0.05 }),
      );
      rec.track(victim.id);
      rec.notes.victimId = victim.id;
      rec.tick(2); // tick 1: dot ticks -> lethal -> guard fires; the index-0 buff survives
      rec.snapshot('dot-guard');

      // ----- Phase B: updateRegen eat/drink + an aura-expiry statsDirty recalc -----
      // Out of combat with hp/mana to recover, sitting to eat + drink. updateRegen fires
      // every 40 ticks (the 2s classic tick): the food heal runs ctx.healingTakenMult +
      // the 'heal' emit, the drink restores mana, and the short buff_ap expires inside
      // updateAuras -> statsDirty -> recalcPlayerStats (+ applyNonPlayerStatAura).
      p.inCombat = false;
      p.combatTimer = 99;
      p.fiveSecondRule = 99;
      p.hp = Math.max(1, p.maxHp - 600);
      p.resource = Math.max(0, p.maxResource - 300);
      p.eating = { itemId: 'parity_food', kind: 'food', hpPer2s: 90, manaPer2s: 0, remaining: 6 };
      p.drinking = { itemId: 'parity_drink', kind: 'drink', hpPer2s: 0, manaPer2s: 50, remaining: 6 };
      p.auras.push(aura({ id: 'short_buff', name: 'Blessing', kind: 'buff_ap', value: 20, sourceId: p.id, duration: 1.5 }));
      rec.tick(60); // >40: updateRegen fires (tick 40); buff_ap expires -> statsDirty recalc
      rec.snapshot('regen-expiry');

      // ----- Phase C: a ground AoE pulsing over 2+ hostiles -----
      // Two beefed mobs clustered inside consecration's 8yd radius so pulseGroundAoE
      // iterates hostilesInRadius (>=2 targets), drawing rng.range once per target in
      // entities-insertion order, from BOTH callers (the on-cast pulse + deferred ticks).
      const a1 = spawnMob(sim, 'forest_wolf', 5, p.pos.x + 2, p.pos.y, p.pos.z + 2);
      const a2 = spawnMob(sim, 'forest_wolf', 5, p.pos.x - 2, p.pos.y, p.pos.z - 2);
      for (const m of [a1, a2]) {
        beef(m, 40000);
        m.hostile = true;
      }
      rec.track(a1.id, a2.id);
      rec.notes.aoeMobIds = [a1.id, a2.id];
      p.resource = p.maxResource;
      p.gcdRemaining = 0;
      sim.castAbility('consecration'); // immediate on-cast pulse + deferred interval pulses
      rec.tick(20 * 6); // 6s of interval-2 deferred pulses over both mobs
    },
  };
}

// C4a casting lifecycle: drives the player cast lifecycle end to end across three
// caster classes plus a fishing cast, so the cast-start / updateCasting-progress /
// pushback / cancel / channel-tick / finish branches and their rng draws are all
// pinned in one trace. Forks no behavior off castAbility -> updateCasting; every
// interrupt rides the real dealDamage spell-pushback block (cancel vs pushback).
//  - mage fireball: timed-cast START (gcd arm) -> a mid-cast melee hit takes the
//    pushbackCast timed branch (+CAST_PUSHBACK_SEC) -> the cast FINISHES ->
//    applyAbility spell-hit roll (rng.chance(spellHitChance)) -> runEffects.
//  - priest lesser_heal (self): timed-cast START -> a silence aura lands ->
//    updateCasting's silence branch CANCELS it (cancelCast, castStop success:false).
//  - warlock drain_life: channel START (spend+arm at START) -> applyChannelTick
//    fires (drainTick rng.range draw + dealDamage + self-heal + healingThreat) ->
//    a mid-channel hit takes the pushbackCast channel-fraction branch.
//  - warlock fishing cast: a non-lethal hit CANCELS it (the FISHING_CAST_ID arm of
//    dealDamage's spell-pushback block -> cancelCast, not pushback).
function c4aCastingLifecycle(): Scenario {
  return {
    name: 'c4a_casting_lifecycle',
    coverage: [
      'castAbility timed-cast START (mage fireball) + Math.max gcd arm',
      'updateCasting progress + finish -> applyAbility spell-hit roll (rng) -> runEffects',
      'pushbackCast timed branch (+CAST_PUSHBACK_SEC) via dealDamage mid-cast',
      'updateCasting silence branch -> cancelCast (priest lesser_heal, holy)',
      'castAbility channel START (warlock drain_life): spend+arm at START',
      'applyChannelTick drainTick (rng.range draw + dealDamage + self-heal + healingThreat)',
      'pushbackCast channel-fraction branch via dealDamage mid-channel',
      'cancelCast fishing arm via dealDamage (FISHING_CAST_ID, not pushback)',
      'multi-class casters: mage/priest/warlock',
    ],
    sampleEvery: 5,
    build: () => new Sim({ seed: 1017, playerClass: 'mage', noPlayer: true }),
    drive(rec: Recorder) {
      const sim = rec.sim as AnySim;
      const mage = sim.addPlayer('mage', 'Mg') as number;
      const priest = sim.addPlayer('priest', 'Pr') as number;
      const warlock = sim.addPlayer('warlock', 'Wl') as number;
      const eMage = sim.entities.get(mage) as AnyEntity;
      const ePriest = sim.entities.get(priest) as AnyEntity;
      const eWarlock = sim.entities.get(warlock) as AnyEntity;
      // Level 12: fireball rank 3 (2.5s), lesser_heal rank 3 (2.0s, holy),
      // drain_life rank 1 (5s channel / 5 ticks = 1s per tick). drain_life needs >=10.
      for (const pid of [mage, priest, warlock]) sim.setPlayerLevel(12, pid);
      teleport(sim, eMage, -3, -45);
      teleport(sim, ePriest, 0, -45);
      teleport(sim, eWarlock, 3, -45);
      for (const e of [eMage, ePriest, eWarlock]) beef(e, 20000);

      // An idle (un-aggroed) hostile dummy the casters target; hostile=true so
      // isHostileTo passes, aiState idle so it does not retaliate mid-cast.
      const mob = spawnMob(sim, 'forest_wolf', 8, 0, eMage.pos.y, -40);
      beef(mob, 200000);
      mob.hostile = true;
      mob.aiState = 'idle';
      rec.track(mob.id);
      rec.notes.mageId = mage;
      rec.notes.priestId = priest;
      rec.notes.warlockId = warlock;
      rec.notes.mobId = mob.id;

      // --- mage: timed-cast start -> mid-cast pushback -> finish -> applyAbility ---
      eMage.resource = eMage.maxResource;
      face(eMage, mob);
      sim.targetEntity(mob.id, mage);
      sim.castAbility('fireball', mage); // timed-cast START (castStart)
      rec.tick(1); // updateCasting progress one tick
      sim.dealDamage(mob, eMage, 40, false, 'physical', null, 'hit'); // pushbackCast timed branch
      rec.snapshot('mage-pushback');
      rec.tick(120); // let the 2.5s cast (+ pushback) finish -> applyAbility -> runEffects

      // --- priest: timed self-heal start -> silence lands -> updateCasting cancel ---
      ePriest.hp = Math.max(1, ePriest.maxHp - 1000);
      ePriest.resource = ePriest.maxResource;
      sim.castAbility('lesser_heal', priest); // self (friendly fallback), timed START
      rec.tick(1); // progress one tick (no interrupt yet)
      ePriest.auras.push(
        aura({ id: 'c4a_silence', name: 'Silenced', kind: 'silence', value: 0, sourceId: mob.id, duration: 4 }),
      );
      rec.tick(1); // updateCasting silence branch -> cancelCast (castStop success:false)
      rec.snapshot('priest-silence-cancel');

      // --- warlock: channel start -> channel tick -> channel-fraction pushback ---
      eWarlock.hp = Math.max(1, eWarlock.maxHp - 500); // so the drain self-heal lands
      eWarlock.resource = eWarlock.maxResource;
      face(eWarlock, mob);
      sim.targetEntity(mob.id, warlock);
      sim.castAbility('drain_life', warlock); // channel START (spend+arm at START)
      rec.tick(22); // first channel tick fires at ~1s (20 ticks): applyChannelTick draws rng
      sim.dealDamage(mob, eWarlock, 40, false, 'physical', null, 'hit'); // pushbackCast channel branch
      rec.snapshot('warlock-channel-pushback');
      rec.tick(8);

      // --- warlock: a fishing cast cancelled by a hit (cancelCast fishing arm) ---
      eWarlock.castingAbility = FISHING_CAST_ID;
      eWarlock.castRemaining = 5;
      eWarlock.castTotal = 5;
      eWarlock.channeling = false;
      sim.dealDamage(mob, eWarlock, 20, false, 'physical', null, 'hit'); // cancelCast, not pushback
      rec.snapshot('warlock-fishing-cancel');
      rec.tick(5);
    },
  };
}

export const SCENARIOS: Scenario[] = [
  soloWarrior(),
  soloMage(),
  soloRogue(),
  affixMob(),
  mobSwingAffixes(),
  hunterPet(),
  warlockPet(),
  paladinConsecration(),
  arena1v1(),
  fiesta(),
  fiestaPowerups(),
  duelToWinner(),
  arena2v2Wipe(),
  delveLockpick(),
  partyLoot(),
  partyRaid(),
  entityRoster(),
  delveDeath(),
  fiestaMidcastKill(),
  multiClassFrenzy(),
  mobTargeting(),
  questKillCredit(),
  questCollectTurnIn(),
  talentsProgression(),
  multiClassHeal(),
  mobLocomotion(),
  delveProgression(),
  dungeonInstances(),
  dungeonRaidLockout(),
  c3AuraRunner(),
  c4aCastingLifecycle(),
];
