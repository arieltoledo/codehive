import { execSync } from "node:child_process";
import os from "node:os";

export class SchedulerUtil {
  static async install(schedule: {
    id: string;
    agentId: string;
    command: string;
    wakeupAt: Date;
  }): Promise<void> {
    if (os.platform() === "win32") {
      await this.installWindows(schedule);
    } else {
      await this.installUnix(schedule);
    }
  }

  static async remove(scheduleId: string): Promise<void> {
    if (os.platform() === "win32") {
      this.removeWindows(scheduleId);
    } else {
      this.removeUnix(scheduleId);
    }
  }

  private static async installUnix(schedule: {
    id: string;
    command: string;
    wakeupAt: Date;
  }): Promise<void> {
    const minute = schedule.wakeupAt.getMinutes();
    const hour = schedule.wakeupAt.getHours();
    const day = schedule.wakeupAt.getDate();
    const month = schedule.wakeupAt.getMonth() + 1;
    const cronExpr = `${minute} ${hour} ${day} ${month} *`;

    const comment = `# codehive-wakeup-${schedule.id}`;
    const cronLine = `${cronExpr} ${schedule.command}`;

    try {
      const existing = execSync("crontab -l 2>/dev/null || true", {
        encoding: "utf-8",
      });
      if (existing.includes(`codehive-wakeup-${schedule.id}`)) return;
      const updated = existing + `${comment}\n${cronLine}\n`;
      execSync("crontab", { input: updated });
    } catch {
      // fallback: try `at` command
      const timeStr = schedule.wakeupAt.toISOString();
      const formatted = schedule.wakeupAt
        .toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        })
        .replace(/^24:/, "00:");
      const dateStr = schedule.wakeupAt
        .toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\//g, "");
      try {
        execSync(`echo "${schedule.command}" | at ${formatted} ${dateStr} 2>/dev/null`, {
          timeout: 5000,
        });
      } catch {
        console.error("SchedulerUtil: no crontab or at available");
      }
    }
  }

  private static installWindows(schedule: {
    id: string;
    command: string;
    wakeupAt: Date;
  }): void {
    const taskName = `codehive-wakeup-${schedule.id}`;
    const time = schedule.wakeupAt.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    const date = schedule.wakeupAt
      .toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, "/");

    try {
      execSync(
        `schtasks /create /sc once /tn "${taskName}" /st ${time} /sd ${date} /tr "${schedule.command}" /f`,
        { timeout: 5000 },
      );
    } catch (e) {
      console.error("SchedulerUtil: failed to create Windows scheduled task:", e);
    }
  }

  private static removeUnix(scheduleId: string): void {
    try {
      const existing = execSync("crontab -l 2>/dev/null || true", {
        encoding: "utf-8",
      });
      const updated = existing
        .split("\n")
        .filter((line) => !line.includes(`codehive-wakeup-${scheduleId}`))
        .join("\n");
      if (updated.trim() !== existing.trim()) {
        execSync("crontab", { input: updated });
      }
    } catch {
      // ignore
    }
  }

  private static removeWindows(scheduleId: string): void {
    try {
      execSync(`schtasks /delete /tn "codehive-wakeup-${scheduleId}" /f`, {
        timeout: 5000,
      });
    } catch {
      // ignore
    }
  }
}
