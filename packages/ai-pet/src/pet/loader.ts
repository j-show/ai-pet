import { convertFileSrc, invoke } from '@tauri-apps/api/core';

import {
  CODEX_DEFAULT_ANIMATIONS,
  CODEX_DEFAULT_ATLAS,
  DEFAULT_CHROMA_KEY,
  DEFAULT_PET_BASE,
  DEFAULT_PET_ID
} from './codex-defaults';
import type { LoadedPet, PetAnimation, PetManifest, PetState } from './types';

interface ResolvedUserPet {
  manifest: PetManifest;
  spritesheetPath: string;
}

const animationMap = (
  animations: PetAnimation[]
): Map<PetState, PetAnimation> =>
  new Map(animations.map(anim => [anim.state, anim]));

const resolveAtlas = (manifest: PetManifest) =>
  manifest.atlas ?? CODEX_DEFAULT_ATLAS;

const resolveAnimations = (manifest: PetManifest) =>
  manifest.animations ?? CODEX_DEFAULT_ANIMATIONS;

const buildLoadedPet = (
  manifest: PetManifest,
  spritesheetUrl: string
): LoadedPet => {
  const atlas = resolveAtlas(manifest);
  const animations = resolveAnimations(manifest);

  return {
    manifest: {
      ...manifest,
      chromaKey: manifest.chromaKey ?? DEFAULT_CHROMA_KEY
    },
    spritesheetUrl,
    atlas,
    animations: animationMap(animations)
  };
};

const fetchDefaultManifest = async (): Promise<PetManifest> => {
  const response = await fetch(`${DEFAULT_PET_BASE}/pet.json`);
  if (!response.ok) {
    throw new Error(`Failed to load default pet manifest: ${response.status}`);
  }

  return (await response.json()) as PetManifest;
};

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Failed to load spritesheet: ${url}`));
    image.src = url;
  });
};

const tryLoadUserPet = async (
  petId: string
): Promise<{
  pet: LoadedPet;
  spritesheet: HTMLImageElement;
} | null> => {
  const resolved = await invoke<ResolvedUserPet | null>('resolve_user_pet', {
    petId
  });
  if (!resolved) return null;

  const manifest = resolved.manifest;
  const spritesheetUrl = convertFileSrc(resolved.spritesheetPath);
  const spritesheet = await loadImage(spritesheetUrl);

  return {
    pet: buildLoadedPet(manifest, spritesheetUrl),
    spritesheet
  };
};

const loadDefaultPet = async (): Promise<{
  pet: LoadedPet;
  spritesheet: HTMLImageElement;
}> => {
  const manifest = await fetchDefaultManifest();
  const spritesheetUrl = `${DEFAULT_PET_BASE}/${manifest.spritesheetPath}`;
  const spritesheet = await loadImage(spritesheetUrl);

  return {
    pet: buildLoadedPet(manifest, spritesheetUrl),
    spritesheet
  };
};

/**
 * Load a pet by id: user dir first (`~/.ai-pet/pets/<id>`), then bundled `public/default/`.
 * @param petId - Pet directory name; defaults to {@link DEFAULT_PET_ID}.
 */
export const loadPet = async (
  petId = DEFAULT_PET_ID
): Promise<{
  pet: LoadedPet;
  spritesheet: HTMLImageElement;
}> => {
  const requestedPetId = petId.trim();
  if (requestedPetId) {
    try {
      const userPet = await tryLoadUserPet(requestedPetId);
      if (userPet) return userPet;
    } catch (error) {
      console.warn(
        `Failed to load pet "${requestedPetId}" from ~/.ai-pet/pets, using default:`,
        error
      );
    }
  }

  return loadDefaultPet();
};
