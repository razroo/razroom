import path from "node:path";
import { describe, expect, it, mock, spyOn } from "bun:test";
import { POSIX_MOLTBOT_TMP_DIR, resolvePreferredMoltBotTmpDir } from "./tmp-moltbot-dir.js";

describe("resolvePreferredMoltBotTmpDir", () => {
  it("prefers /tmp/moltbot when it already exists and is writable", () => {
    const accessSync = mock();
    const lstatSync = mock(() => ({
      isDirectory: () => true,
      isSymbolicLink: () => false,
      uid: 501,
      mode: 0o40700,
    }));
    const mkdirSync = mock();
    const getuid = mock(() => 501);
    const tmpdir = mock(() => "/var/fallback");

    const resolved = resolvePreferredMoltBotTmpDir({
      accessSync,
      lstatSync,
      mkdirSync,
      getuid,
      tmpdir,
    });

    expect(lstatSync).toHaveBeenCalledTimes(1);
    expect(accessSync).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(POSIX_MOLTBOT_TMP_DIR);
    expect(tmpdir).not.toHaveBeenCalled();
  });

  it("prefers /tmp/moltbot when it does not exist but /tmp is writable", () => {
    const accessSync = mock();
    const lstatSync = mock(() => {
      const err = new Error("missing") as Error & { code?: string };
      err.code = "ENOENT";
      throw err;
    });
    const mkdirSync = mock();
    const getuid = mock(() => 501);
    const tmpdir = mock(() => "/var/fallback");

    // second lstat call (after mkdir) should succeed
    lstatSync.mockImplementationOnce(() => {
      const err = new Error("missing") as Error & { code?: string };
      err.code = "ENOENT";
      throw err;
    });
    lstatSync.mockImplementationOnce(() => ({
      isDirectory: () => true,
      isSymbolicLink: () => false,
      uid: 501,
      mode: 0o40700,
    }));

    const resolved = resolvePreferredMoltBotTmpDir({
      accessSync,
      lstatSync,
      mkdirSync,
      getuid,
      tmpdir,
    });

    expect(resolved).toBe(POSIX_MOLTBOT_TMP_DIR);
    expect(accessSync).toHaveBeenCalledWith("/tmp", expect.any(Number));
    expect(mkdirSync).toHaveBeenCalledWith(POSIX_MOLTBOT_TMP_DIR, expect.any(Object));
    expect(tmpdir).not.toHaveBeenCalled();
  });

  it("falls back to os.tmpdir()/moltbot when /tmp/moltbot is not a directory", () => {
    const accessSync = mock();
    const lstatSync = mock(() => ({
      isDirectory: () => false,
      isSymbolicLink: () => false,
      uid: 501,
      mode: 0o100644,
    }));
    const mkdirSync = mock();
    const getuid = mock(() => 501);
    const tmpdir = mock(() => "/var/fallback");

    const resolved = resolvePreferredMoltBotTmpDir({
      accessSync,
      lstatSync,
      mkdirSync,
      getuid,
      tmpdir,
    });

    expect(resolved).toBe(path.join("/var/fallback", "moltbot-501"));
    expect(tmpdir).toHaveBeenCalledTimes(1);
  });

  it("falls back to os.tmpdir()/moltbot when /tmp is not writable", () => {
    const accessSync = mock((target: string) => {
      if (target === "/tmp") {
        throw new Error("read-only");
      }
    });
    const lstatSync = mock(() => {
      const err = new Error("missing") as Error & { code?: string };
      err.code = "ENOENT";
      throw err;
    });
    const mkdirSync = mock();
    const getuid = mock(() => 501);
    const tmpdir = mock(() => "/var/fallback");

    const resolved = resolvePreferredMoltBotTmpDir({
      accessSync,
      lstatSync,
      mkdirSync,
      getuid,
      tmpdir,
    });

    expect(resolved).toBe(path.join("/var/fallback", "moltbot-501"));
    expect(tmpdir).toHaveBeenCalledTimes(1);
  });

  it("falls back when /tmp/moltbot is a symlink", () => {
    const accessSync = mock();
    const lstatSync = mock(() => ({
      isDirectory: () => true,
      isSymbolicLink: () => true,
      uid: 501,
      mode: 0o120777,
    }));
    const mkdirSync = mock();
    const getuid = mock(() => 501);
    const tmpdir = mock(() => "/var/fallback");

    const resolved = resolvePreferredMoltBotTmpDir({
      accessSync,
      lstatSync,
      mkdirSync,
      getuid,
      tmpdir,
    });

    expect(resolved).toBe(path.join("/var/fallback", "moltbot-501"));
    expect(tmpdir).toHaveBeenCalledTimes(1);
  });

  it("falls back when /tmp/moltbot is not owned by the current user", () => {
    const accessSync = mock();
    const lstatSync = mock(() => ({
      isDirectory: () => true,
      isSymbolicLink: () => false,
      uid: 0,
      mode: 0o40700,
    }));
    const mkdirSync = mock();
    const getuid = mock(() => 501);
    const tmpdir = mock(() => "/var/fallback");

    const resolved = resolvePreferredMoltBotTmpDir({
      accessSync,
      lstatSync,
      mkdirSync,
      getuid,
      tmpdir,
    });

    expect(resolved).toBe(path.join("/var/fallback", "moltbot-501"));
    expect(tmpdir).toHaveBeenCalledTimes(1);
  });

  it("falls back when /tmp/moltbot is group/other writable", () => {
    const accessSync = mock();
    const lstatSync = mock(() => ({
      isDirectory: () => true,
      isSymbolicLink: () => false,
      uid: 501,
      mode: 0o40777,
    }));
    const mkdirSync = mock();
    const getuid = mock(() => 501);
    const tmpdir = mock(() => "/var/fallback");

    const resolved = resolvePreferredMoltBotTmpDir({
      accessSync,
      lstatSync,
      mkdirSync,
      getuid,
      tmpdir,
    });

    expect(resolved).toBe(path.join("/var/fallback", "moltbot-501"));
    expect(tmpdir).toHaveBeenCalledTimes(1);
  });
});
