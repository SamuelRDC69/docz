import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { VISUALS, type ClipMap } from '../src/render/characters/manifest';

function expectedClipNames(clips: ClipMap): string[] {
  return [
    clips.idle, clips.walk, clips.run, clips.death,
    clips.cast, clips.sitDown, clips.sitIdle, clips.swim, clips.jump, clips.walkBack, clips.flourish,
    ...clips.attack,
    ...(clips.hit ?? []),
    ...Object.values(clips.emote ?? {}).flatMap((spec) => spec.clips),
  ].filter((name): name is string => !!name);
}

async function glbAnimationNames(path: string): Promise<Set<string>> {
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(path);
  return new Set(doc.getRoot().listAnimations().map((animation) => animation.getName()));
}

describe('character visual manifest', () => {
  it('uses the custom boar death clip without relying on a speed override', () => {
    expect(VISUALS.mob_boar.clips.death).toBe('Dying');
    expect(VISUALS.mob_boar.deathTimeScale).toBeUndefined();
  });

  it('points the Combat Mech manifest at animation clips baked into the GLB', async () => {
    const visual = VISUALS.player_mech;
    const animationNames = await glbAnimationNames(`public/${visual.url}`);

    expect(animationNames.size).toBeGreaterThan(0);
    expect([...new Set(expectedClipNames(visual.clips))].filter((name) => !animationNames.has(name))).toEqual([]);
  });
});
