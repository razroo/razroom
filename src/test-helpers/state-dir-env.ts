type StateDirEnvSnapshot = {
  moltbotStateDir: string | undefined;
  moltbotStateDir: string | undefined;
};

export function snapshotStateDirEnv(): StateDirEnvSnapshot {
  return {
    moltbotStateDir: process.env.MOLTBOT_STATE_DIR,
    moltbotStateDir: process.env.MOLTBOT_STATE_DIR,
  };
}

export function restoreStateDirEnv(snapshot: StateDirEnvSnapshot): void {
  if (snapshot.moltbotStateDir === undefined) {
    delete process.env.MOLTBOT_STATE_DIR;
  } else {
    process.env.MOLTBOT_STATE_DIR = snapshot.moltbotStateDir;
  }
  if (snapshot.moltbotStateDir === undefined) {
    delete process.env.MOLTBOT_STATE_DIR;
  } else {
    process.env.MOLTBOT_STATE_DIR = snapshot.moltbotStateDir;
  }
}

export function setStateDirEnv(stateDir: string): void {
  process.env.MOLTBOT_STATE_DIR = stateDir;
  delete process.env.MOLTBOT_STATE_DIR;
}
