type StateDirEnvSnapshot = {
  moltbotStateDir: string | undefined;
  clawdbotStateDir: string | undefined;
};

export function snapshotStateDirEnv(): StateDirEnvSnapshot {
  return {
    moltbotStateDir: process.env.MOLTBOT_STATE_DIR,
    clawdbotStateDir: process.env.CLAWDBOT_STATE_DIR,
  };
}

export function restoreStateDirEnv(snapshot: StateDirEnvSnapshot): void {
  if (snapshot.moltbotStateDir === undefined) {
    delete process.env.MOLTBOT_STATE_DIR;
  } else {
    process.env.MOLTBOT_STATE_DIR = snapshot.moltbotStateDir;
  }
  if (snapshot.clawdbotStateDir === undefined) {
    delete process.env.CLAWDBOT_STATE_DIR;
  } else {
    process.env.CLAWDBOT_STATE_DIR = snapshot.clawdbotStateDir;
  }
}

export function setStateDirEnv(stateDir: string): void {
  process.env.MOLTBOT_STATE_DIR = stateDir;
  delete process.env.CLAWDBOT_STATE_DIR;
}
