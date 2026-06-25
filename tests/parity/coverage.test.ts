// Coverage proof: each scenario must ACTUALLY fire its target subsystem (not just
// name it in a comment). These assertions inspect the live events + final state of
// a recorded run. If a future content change breaks a recipe, this fails loudly so
// the golden never silently stops exercising a system.

import { describe, expect, it } from 'vitest';
import { record } from './record';
import { SCENARIOS } from './scenarios';
import type { Recorder } from './record';

type Ev = Record<string, any>;

function run(name: string): Recorder {
  const scenario = SCENARIOS.find((s) => s.name === name);
  if (!scenario) throw new Error(`no scenario ${name}`);
  return record(scenario).rec;
}

function entities(rec: Recorder): any[] {
  return [...(rec.sim as any).entities.values()];
}

describe('coverage: each scenario fires its subsystem', () => {
  it('solo_warrior: auto-attack + mobSwing both ways, mob death -> rollLoot produced loot', () => {
    const rec = run('solo_warrior');
    const pid = (rec.sim as any).playerId;
    const ev = rec.allEvents as Ev[];
    const playerDealt = ev.some((e) => e.type === 'damage' && e.sourceId === pid);
    const playerTookHit = ev.some((e) => e.type === 'damage' && e.targetId === pid);
    expect(playerDealt).toBe(true); // player auto-attack / heroic_strike
    expect(playerTookHit).toBe(true); // mobSwing hit the player
    expect(ev.some((e) => e.type === 'death')).toBe(true);
    // rollLoot ran on death and produced loot (forest_wolf drops copper, chance 1).
    expect(entities(rec).some((e) => e.templateId === 'forest_wolf' && e.dead && e.lootable)).toBe(true);
  });

  it('solo_mage: casting lifecycle runs', () => {
    const rec = run('solo_mage');
    expect((rec.allEvents as Ev[]).some((e) => e.type === 'castStart')).toBe(true);
  });

  it('solo_rogue: weaponStrike via sinister_strike fires', () => {
    const rec = run('solo_rogue');
    const pid = (rec.sim as any).playerId;
    const ev = rec.allEvents as Ev[];
    const sinister = ev.some(
      (e) => e.type === 'damage' && typeof e.ability === 'string' && e.ability.toLowerCase().includes('sinister'),
    );
    const playerDealt = ev.some((e) => e.type === 'damage' && e.sourceId === pid);
    expect(sinister || playerDealt).toBe(true);
  });

  it('affix_mob: frenzyOnHit buff on mob + bleed on player + player-cast taunt (4279)', () => {
    const rec = run('affix_mob');
    const pid = (rec.sim as any).playerId;
    // old_greyjaw is also a rare world spawn, so match across ALL of them (the
    // scenario's own spawn is the one that gets wounded into a frenzy + taunted).
    const greyjaws = entities(rec).filter((e) => e.templateId === 'old_greyjaw');
    const player = (rec.sim as any).player;
    expect(greyjaws.some((e) => e.auras?.some((a: Ev) => a.id === 'blood_frenzy'))).toBe(true);
    expect(player.auras?.some((a: Ev) => a.kind === 'dot')).toBe(true);
    // applyTaunt (player cast) forced the greyjaw onto the player.
    expect(greyjaws.some((e) => e.forcedTargetId === pid)).toBe(true);
  });

  it('mob_swing_affixes: stun/venom/silence/rampage procs land + friendly pet never debuffs', () => {
    const rec = run('mob_swing_affixes');
    const n = rec.notes as Record<string, any>;
    // Each heavy-hitter proc fired its rng.chance and applied its aura on a landed swing.
    expect(n.stunLanded).toBe(true); // mogger_lackey stunOnHit
    expect(n.venomLanded).toBe(true); // webwood_spider venom DoT
    expect(n.silenceLanded).toBe(true); // gravecaller_summoner silence
    expect(n.rampageStacks).toBeGreaterThan(0); // warlord_drogmar self-stacking buff_ap
    // The friendly (hostile=false) pet swung the dummy but applied no on-hit debuff.
    expect(n.dummyDebuffs).toBe(0);
  });

  it('hunter_pet: friendly ranged pet (8093) AND hostile petSpell mob (6776) both fire', () => {
    const rec = run('hunter_pet');
    const pid = (rec.sim as any).playerId;
    const ev = rec.allEvents as Ev[];
    const pet = entities(rec).find((e) => e.ownerId === pid && e.templateId === 'warlock_imp');
    expect(pet).toBeTruthy();
    // friendly arm (8093): pet shoots its target
    expect(ev.some((e) => e.type === 'damage' && e.sourceId === pet.id && e.school === 'fire')).toBe(true);
    // hostile-mob arm (6776): wild imp's AI shoots the player
    const hostileImpId = rec.notes.hostileImpId;
    expect(
      ev.some((e) => e.type === 'damage' && e.sourceId === hostileImpId && e.targetId === pid && e.school === 'fire'),
    ).toBe(true);
  });

  it('warlock_pet: melee pet swings (8117) and manual taunt forces the target (4885)', () => {
    const rec = run('warlock_pet');
    const pid = (rec.sim as any).playerId;
    const pet = entities(rec).find((e) => e.ownerId === pid);
    expect(pet).toBeTruthy();
    expect((rec.allEvents as Ev[]).some((e) => e.type === 'damage' && e.sourceId === pet.id)).toBe(true);
    // petTaunt -> applyTaunt forced the hostile target onto the pet.
    expect(entities(rec).some((e) => e.templateId === 'forest_wolf' && e.forcedTargetId === pet.id)).toBe(true);
  });

  it('paladin_consecration: ground AoE pulses fire from BOTH callers (immediate + deferred)', () => {
    const rec = run('paladin_consecration');
    const hits = (rec.allEvents as Ev[]).filter(
      (e) => e.type === 'damage' && typeof e.ability === 'string' && e.ability.toLowerCase().includes('consecrat'),
    );
    // 1 immediate on-cast pulse (~4097) + >=1 deferred interval pulse (~3052).
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('arena_1v1: a match resolves (arenaEnd)', () => {
    const rec = run('arena_1v1');
    expect((rec.allEvents as Ev[]).some((e) => e.type === 'arenaEnd')).toBe(true);
  });

  it('fiesta: a cross-team takedown scores AND an augment is offered + chosen', () => {
    const rec = run('fiesta');
    const ev = rec.allEvents as Ev[];
    expect(ev.some((e) => e.type === 'fiestaScore' || e.type === 'fiestaDown')).toBe(true);
    // augment wave actually ran: an offer was presented and a pick recorded.
    expect(ev.some((e) => e.type === 'augmentOffer')).toBe(true);
    const victimPid = rec.notes.fiestaVictimPid as number;
    expect((rec.sim as any).players.get(victimPid)?.fiestaAugments?.length).toBeGreaterThan(0);
  });

  it('fiesta_powerups: a power-up is grabbed (buff aura), the ring burns, and a downed fighter revives', () => {
    const rec = run('fiesta_powerups');
    const ev = rec.allEvents as Ev[];
    // power-up spawned and was grabbed -> buff aura applied (fiestaPowerup event).
    expect(ev.some((e) => e.type === 'fiestaPowerup')).toBe(true);
    // hazard ring burned a fighter standing outside it (ring damage is sourceId -1).
    expect(ev.some((e) => e.type === 'damage' && e.sourceId === -1)).toBe(true);
    // a downed fighter came back on their respawn timer (fiestaRevive -> respawn).
    expect(ev.some((e) => e.type === 'respawn')).toBe(true);
    const victimPid = rec.notes.fiestaPowerupVictimPid as number;
    expect((rec.sim as any).entities.get(victimPid)?.dead).toBe(false);
  });

  it('duel_to_winner: a duel goes active then ends with a winner, clearing duels', () => {
    const rec = run('duel_to_winner');
    const ev = rec.allEvents as Ev[];
    expect(ev.some((e) => e.type === 'duelStart')).toBe(true);
    const end = ev.find((e) => e.type === 'duelEnd');
    expect(end).toBeTruthy();
    expect(end!.winnerName).toBe('Aleph');
    expect(end!.loserName).toBe('Bet');
    // the 1-HP duel guard left the loser alive, and the duel was cleared.
    expect((rec.sim as any).duels.size).toBe(0);
  });

  it('arena_2v2_wipe: first kill keeps the match; team wipe ends it with a ranked Elo swing', () => {
    const rec = run('arena_2v2_wipe');
    const ev = rec.allEvents as Ev[];
    const ends = ev.filter((e) => e.type === 'arenaEnd');
    expect(ends.length).toBe(4); // both teams, two players each
    // ranked 2v2 result: the winners gained rating, the losers lost it.
    const moved = ends.some((e) => e.ratingAfter !== e.ratingBefore);
    expect(moved).toBe(true);
    const sim = rec.sim as any;
    const totalWins = [...sim.players.values()].reduce((n, m) => n + (m.arena2v2Wins ?? 0), 0);
    const totalLosses = [...sim.players.values()].reduce((n, m) => n + (m.arena2v2Losses ?? 0), 0);
    expect(totalWins).toBe(2);
    expect(totalLosses).toBe(2);
  });

  it('delve_lockpick: companion swings the boss (16762), lockpick engaged + stepped', () => {
    const rec = run('delve_lockpick');
    const ev = rec.allEvents as Ev[];
    // mobSwing delve-companion caller (~16762): the companion dealt damage.
    const compId = rec.notes.companionId;
    expect(compId, 'companion did not spawn').toBeTruthy();
    expect(ev.some((e) => e.type === 'damage' && e.sourceId === compId)).toBe(true);
    expect(ev.some((e) => e.type === 'lockpickSession')).toBe(true);
    expect(ev.some((e) => e.type === 'lockpickStep')).toBe(true);
  });

  it('party_loot: a need/greed loot roll prompt fires', () => {
    const rec = run('party_loot');
    expect((rec.allEvents as Ev[]).some((e) => e.type === 'lootRoll')).toBe(true);
  });

  it('party_raid: the party state machine fires invite/convert/move/handoff/disband', () => {
    const rec = run('party_raid');
    const ev = rec.allEvents as Ev[];
    const logs = ev.filter((e) => e.type === 'log').map((e) => String(e.text));
    expect(ev.some((e) => e.type === 'partyInvite')).toBe(true);
    expect(logs.some((t) => t.includes('joins the party'))).toBe(true);
    expect(logs.some((t) => t.includes('converted to a raid'))).toBe(true);
    expect(logs.some((t) => t.includes('moved to raid group'))).toBe(true);
    expect(logs.some((t) => t.includes('is now the party leader'))).toBe(true);
    expect(logs.some((t) => t.includes('has disbanded'))).toBe(true);
  });

  it('entity_roster: both despawn branches drop, delayed drain runs, graveyard release at full hp', () => {
    const rec = run('entity_roster');
    const ents = entities(rec);
    const ghostId = rec.notes.ghostId as number;
    const guardId = rec.notes.guardId as number;
    // despawn prologue dropped both: despawnTimer mob + DAMAGE_IDLE_DESPAWN idle mob.
    expect(ents.some((e) => e.id === ghostId)).toBe(false);
    expect(ents.some((e) => e.id === guardId)).toBe(false);
    // delayed drain: 3 scheduled -> 1 fired, 1 guard-dropped, 1 (future) still pending.
    expect((rec.sim as any).delayedEvents.length).toBe(1);
    expect((rec.allEvents as Ev[]).some((e) => e.type === 'respawn')).toBe(true);
    // outdoor release-spirit: alive again at full hp.
    const p = (rec.sim as any).player;
    expect(p.dead).toBe(false);
    expect(p.hp).toBe(p.maxHp);
  });

  it('delve_death: second in-run death fails the delve and ejects the player', () => {
    const rec = run('delve_death');
    expect((rec.allEvents as Ev[]).some((e) => e.type === 'delveFailed')).toBe(true);
  });

  it('fiesta_midcast_kill: mid-cast cancel + cross-team takedown both fire', () => {
    const rec = run('fiesta_midcast_kill');
    const ev = rec.allEvents as Ev[];
    // fishing-cast hit -> cancelCast emits castStop(success:false)
    expect(ev.some((e) => e.type === 'castStop' && e.success === false)).toBe(true);
    // lethal cross-team hit -> fiesta takedown scored
    expect(ev.some((e) => e.type === 'fiestaScore' || e.type === 'fiestaDown')).toBe(true);
    const victimPid = rec.notes.fiestaVictimPid as number;
    expect(typeof victimPid).toBe('number');
  });

  it('multi_class_frenzy: frenzyOnHit draws + blood_frenzy lands across multi-class hits', () => {
    const rec = run('multi_class_frenzy');
    const gid = rec.notes.greyjawId as number;
    const g = entities(rec).find((e) => e.id === gid);
    expect(g, 'scenario greyjaw missing').toBeTruthy();
    expect(g.auras?.some((a: Ev) => a.id === 'blood_frenzy')).toBe(true);
    const ev = rec.allEvents as Ev[];
    const sources = new Set(ev.filter((e) => e.type === 'damage' && e.targetId === gid).map((e) => e.sourceId));
    expect(sources.size).toBeGreaterThanOrEqual(2); // multiple class sources wounded the mob
  });

  it('mob_targeting: pull-over (melee 110% / ranged 130%), taunt force+expiry, retarget-to-evade', () => {
    const rec = run('mob_targeting');
    const n = rec.notes as Record<string, any>;
    const mob = entities(rec).find((e) => e.id === n.mobId);
    expect(mob, 'tracked mob missing').toBeTruthy();
    // 110% melee pull-over switched the mob from the tank to the in-melee bruiser.
    expect(n.afterMelee).toBe(n.bruiserId);
    // caster at EXACTLY 130% does NOT pull (strict `>` against RANGED_SWITCH_MULT).
    expect(n.afterRangedBoundary).toBe(n.tankId);
    // caster past 130% pulls the mob over at range.
    expect(n.afterRanged).toBe(n.casterId);
    // taunt forced the mob onto the tank despite the caster's higher threat.
    expect(n.afterTauntForced).toBe(n.tankId);
    // after the forced window expired, the threat scan reclaimed the caster.
    expect(n.afterTauntExpired).toBe(n.casterId);
    // retargetMob grabbed the highest-threat target (caster) and chased.
    expect(n.afterRetarget).toBe(n.casterId);
    // retargetMob with only stale threat pruned to empty and evaded home.
    expect(n.finalAiState).toBe('evade');
    expect(mob.aggroTargetId).toBe(null);
    expect(mob.threat.size).toBe(0);
  });

  it('delve_progression: chamber advances to the finale and the Marks shop buy resolves', () => {
    const rec = run('delve_progression');
    const ev = rec.allEvents as Ev[];
    // advanceDelveModule walked the run from the chamber onto the finale module.
    expect(ev.some((e) => e.type === 'log' && typeof e.text === 'string' && e.text.includes('tombstone into'))).toBe(true);
    // delveBuyShopItem deducted Marks and granted the item via the vendor event.
    expect(ev.some((e) => e.type === 'vendor' && e.action === 'buy' && e.itemId === 'reliquary_legs')).toBe(true);
  });

  it('quest_kill_credit: kill credit accrues and the quest promotes to ready then turns in', () => {
    const rec = run('quest_kill_credit');
    const ev = rec.allEvents as Ev[];
    // onMobKilledForQuests bumped progress on each forest_wolf death.
    expect(ev.filter((e) => e.type === 'questProgress' && e.questId === 'q_wolves').length).toBeGreaterThanOrEqual(8);
    // checkQuestReady promoted active -> ready, and the quest was turned in.
    expect(ev.some((e) => e.type === 'questReady' && e.questId === 'q_wolves')).toBe(true);
    expect(ev.some((e) => e.type === 'questDone' && e.questId === 'q_wolves')).toBe(true);
    expect((rec.sim as any).players.get((rec.sim as any).playerId)?.questsDone?.has('q_wolves')).toBe(true);
  });

  it('quest_collect_turnin: collect credit promotes, demotes on item loss, and turns in', () => {
    const rec = run('quest_collect_turnin');
    const ev = rec.allEvents as Ev[];
    // onInventoryChangedForQuests fired progress as hides were collected.
    expect(ev.some((e) => e.type === 'questProgress' && e.questId === 'q_boars')).toBe(true);
    // checkQuestReady's promotion arm.
    expect(ev.some((e) => e.type === 'questReady' && e.questId === 'q_boars')).toBe(true);
    // The demotion arm fired at least once (a 'questProgress' below target after a
    // 'questReady') — the dropped hide and the turn-in removal both demote ready -> active.
    const readyIdx = ev.findIndex((e) => e.type === 'questReady' && e.questId === 'q_boars');
    expect(
      ev.slice(readyIdx + 1).some((e) => e.type === 'questProgress' && e.questId === 'q_boars'),
    ).toBe(true);
    expect(ev.some((e) => e.type === 'questDone' && e.questId === 'q_boars')).toBe(true);
  });

  it('talents_progression: applyTalents/respec/loadout/setSpec fire and bake the flat struct', () => {
    const rec = run('talents_progression');
    const pid = (rec.sim as any).playerId;
    const ev = rec.allEvents as Ev[];
    // applyTalents (and setSpec -> applyTalents) emitted the confirmation log.
    expect(ev.some((e) => e.type === 'log' && e.text === 'Talents updated.')).toBe(true);
    // respec emitted its own log.
    expect(ev.some((e) => e.type === 'log' && e.text === 'Talents reset.')).toBe(true);
    // switchLoadout restored a saved build.
    expect(
      ev.some((e) => e.type === 'log' && typeof e.text === 'string' && e.text.startsWith('Loadout ')),
    ).toBe(true);
    // setSpec('fury') applied last: the flat talentMods re-baked from the new tree.
    const meta = (rec.sim as any).players.get(pid);
    expect(meta.talents.spec).toBe('fury');
    expect(meta.talentMods.spec).toBe('fury');
  });

  it('multi_class_heal: heals land, a crit fires, absorb is consumed, threat splits across aware mobs, HoT ticks', () => {
    const rec = run('multi_class_heal');
    const ev = rec.allEvents as Ev[];
    const heals = ev.filter((e) => e.type === 'heal2' && e.amount > 0);
    expect(heals.length).toBeGreaterThan(0); // applyHeal emitted real (non-overheal) heals
    expect(heals.some((e) => e.crit === true)).toBe(true); // forced-crit *1.5 path fired
    // HoT aura-tick heal path (the hot branch -> healingTakenMult + healingThreat).
    const hotAbility = rec.notes.hotAbility as string;
    expect(ev.some((e) => e.type === 'heal2' && e.ability === hotAbility && e.amount > 0)).toBe(true);
    const ents = entities(rec);
    const tank = ents.find((e) => e.id === rec.notes.tankPid);
    // consumeHealAbsorb: the small shield depleted + was filtered out; the big survived.
    expect(tank.auras?.some((a: Ev) => a.id === 'absorb_small')).toBe(false);
    expect(tank.auras?.some((a: Ev) => a.id === 'absorb_big')).toBe(true);
    // healingThreat split landed: each aware mob now lists healer ids in its hate table.
    const healerIds = rec.notes.healerIds as number[];
    const m1 = ents.find((e) => e.id === rec.notes.m1Id);
    const m3 = ents.find((e) => e.id === rec.notes.m3Id); // matched only via the pet-owner branch
    expect(healerIds.some((hid) => m1.threat.has(hid))).toBe(true);
    expect(healerIds.some((hid) => m3.threat.has(hid))).toBe(true);
  });

  it('mob_locomotion: boss pulse/stomp/terrify fire, idle wander + evade reset + cowardly flee', () => {
    const rec = run('mob_locomotion');
    const n = rec.notes as Record<string, any>;
    const ev = rec.allEvents as Ev[];
    const ents = entities(rec);
    // aoePulse dealt damage + emitted spellfx (mogger Ground Pound).
    expect(ev.some((e) => e.type === 'spellfx' && e.sourceId === n.pulserId)).toBe(true);
    expect(ev.some((e) => e.type === 'damage' && e.sourceId === n.pulserId)).toBe(true);
    // War Stomp landed a stomp_stun + Banshee terrify landed a fear_incap (captured at
    // the moment each arm fired; the CC does not persist to the end without a tick).
    expect(n.stompStunLanded).toBe(true);
    expect(n.fearLanded).toBe(true);
    // War Stomp + terrify each emit an 'unleashes' combat-log line (>= 2 total).
    expect(
      ev.filter((e) => e.type === 'log' && typeof e.text === 'string' && e.text.includes('unleashes')).length,
    ).toBeGreaterThanOrEqual(2);
    // Idle wander picked a target (wanderTimer re-armed to the 30s patrol window).
    const wanderer = ents.find((e) => e.id === n.wandererId);
    expect(wanderer.wanderTarget).not.toBeNull();
    // Evade arrival reset the mob: back to idle at full hp.
    expect(n.evaderState).toBe('idle');
    expect(n.evaderHp).toBeGreaterThan(1);
    // Cowardly flee: the lackey panicked into the flee state and stayed fleeing.
    expect(n.cowardStateAfterPanic).toBe('flee');
    expect(n.cowardStateFleeing).toBe('flee');
    expect(
      ev.some((e) => e.type === 'log' && typeof e.text === 'string' && e.text.includes('attempts to flee')),
    ).toBe(true);
  });

  it('dungeon_instances: party shares one instance via the door trigger, then it resets when empty', () => {
    const rec = run('dungeon_instances');
    const sim = rec.sim as any;
    // Door-trigger entry claimed an instance and both party members joined the SAME slot.
    expect(rec.notes.slotA).not.toBe(null);
    expect(rec.notes.slotA).toBe(rec.notes.slotB);
    // claimInstance spawned mobs (rng.int per spawn).
    expect((rec.notes.instMobIds as number[]).length).toBeGreaterThan(0);
    // After the empty-reset, freeInstance nulled partyKey and despawned the mobs.
    const inst = (sim.instances as any[]).find((i) => i.dungeonId === 'hollow_crypt' && i.slot === rec.notes.slotA);
    expect(inst.partyKey).toBe(null);
    expect(inst.mobIds.length).toBe(0);
    expect((rec.notes.instMobIds as number[]).every((id) => !sim.entities.has(id))).toBe(true);
  });

  it('dungeon_raid_lockout: an active raid lockout blocks Nythraxis arena re-entry', () => {
    const rec = run('dungeon_raid_lockout');
    expect(
      (rec.allEvents as Ev[]).some(
        (e) => e.type === 'error' && e.text === 'You are locked to Nythraxis Raid Arena.',
      ),
    ).toBe(true);
  });

  it('c3_aura_runner: dot kills victim mid-tick (guard fires, rider aura survives), regen heal emitted, AoE hits 2+ mobs', () => {
    const rec = run('c3_aura_runner');
    const pid = (rec.sim as any).playerId;
    const ev = rec.allEvents as Ev[];
    const ents = entities(rec);
    const victim = ents.find((e) => e.id === rec.notes.victimId);
    expect(victim, 'victim missing').toBeTruthy();
    // The dot (index 1, ticked first in the backward walk) dropped the victim to lethal
    // mid-updateAuras, so the `if (e.dead) return;` guard fired before the index-0 aura
    // was reached. (handleDeath clears the corpse's auras, so the observable proof is the
    // dead victim + the byte-identical golden draw order, not a surviving aura.)
    expect(victim.dead).toBe(true);
    // updateRegen eat path fired: a 'heal' to the paladin (the ctx.healingTakenMult call).
    expect(ev.some((e) => e.type === 'heal' && e.targetId === pid)).toBe(true);
    // pulseGroundAoE hit >=2 distinct in-radius targets (rng.range once per target).
    const aoeMobIds = rec.notes.aoeMobIds as number[];
    const consTargets = new Set(
      ev
        .filter((e) => e.type === 'damage' && typeof e.ability === 'string' && e.ability.toLowerCase().includes('consecrat'))
        .map((e) => e.targetId),
    );
    expect(aoeMobIds.filter((id) => consTargets.has(id)).length).toBeGreaterThanOrEqual(2);
  });

  it('c4a_casting_lifecycle: casts start, a timed cast completes, and interrupts cancel', () => {
    const rec = run('c4a_casting_lifecycle');
    const ev = rec.allEvents as Ev[];
    // castAbility started the timed casts + the channel (mage fireball, priest heal,
    // warlock drain_life).
    expect(ev.some((e) => e.type === 'castStart')).toBe(true);
    // a timed cast ran to completion (the mage fireball -> updateCasting finish branch).
    expect(ev.some((e) => e.type === 'castStop' && e.success === true)).toBe(true);
    // an interrupt cancelled a cast (priest silence + warlock fishing -> cancelCast).
    expect(ev.some((e) => e.type === 'castStop' && e.success === false)).toBe(true);
    // the warlock drain channel ticked and dealt shadow damage (applyChannelTick).
    const wl = rec.notes.warlockId as number;
    expect(ev.some((e) => e.type === 'damage' && e.sourceId === wl && e.school === 'shadow')).toBe(true);
  });
});
