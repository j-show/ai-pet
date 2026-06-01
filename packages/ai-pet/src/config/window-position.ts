import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { saveUserEnv, type UserEnv } from './user-env';

export const ENV_WINDOW_RIGHT = 'AI_PET_WINDOW_RIGHT';
/** Screen Y of the window outer frame's top edge. */
export const ENV_WINDOW_TOP = 'AI_PET_WINDOW_TOP';

export interface WindowTopRightAnchor {
  right: number;
  top: number;
}

const parseCoord = (raw: string | undefined): number | null => {
  if (!raw?.trim()) return null;

  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(value)) return null;

  return value;
};

/** Read saved top-right anchor from user env. */
export const parseWindowAnchor = (
  env: UserEnv
): WindowTopRightAnchor | null => {
  const right = parseCoord(env[ENV_WINDOW_RIGHT]);
  const top = parseCoord(env[ENV_WINDOW_TOP]);
  if (right == null || top == null) return null;

  return { right, top };
};

/** Measure current window position using top-right outer corner as anchor. */
export const readWindowTopRightAnchor =
  async (): Promise<WindowTopRightAnchor> => {
    const appWindow = getCurrentWindow();
    const outerPos = await appWindow.outerPosition();
    const outerSize = await appWindow.outerSize();
    return {
      right: outerPos.x + outerSize.width,
      top: outerPos.y
    };
  };

/** Position window so its outer top-right corner matches `anchor`. */
export const applyWindowTopRightAnchor = async (
  anchor: WindowTopRightAnchor
): Promise<void> => {
  const appWindow = getCurrentWindow();
  const outerSize = await appWindow.outerSize();
  const outerLeft = Math.round(anchor.right - outerSize.width);
  await appWindow.setPosition(
    new PhysicalPosition(outerLeft, Math.round(anchor.top))
  );
};

/** Persist top-right anchor to `~/.ai-pet/.env`. */
export const saveWindowTopRightAnchor = async (
  anchor: WindowTopRightAnchor
): Promise<void> => {
  await saveUserEnv({
    [ENV_WINDOW_RIGHT]: String(Math.round(anchor.right)),
    [ENV_WINDOW_TOP]: String(Math.round(anchor.top))
  });
};
