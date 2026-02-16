type StateDirEnvSnapshot = {
  razroomStateDir: string | undefined;
};

export function snapshotStateDirEnv(): StateDirEnvSnapshot {
  return {
    razroomStateDir: process.env.RAZROOM_STATE_DIR,
  };
}

export function restoreStateDirEnv(snapshot: StateDirEnvSnapshot): void {
  if (snapshot.razroomStateDir === undefined) {
    delete process.env.RAZROOM_STATE_DIR;
  } else {
    process.env.RAZROOM_STATE_DIR = snapshot.razroomStateDir;
  }
}

export function setStateDirEnv(stateDir: string): void {
  process.env.RAZROOM_STATE_DIR = stateDir;
}
