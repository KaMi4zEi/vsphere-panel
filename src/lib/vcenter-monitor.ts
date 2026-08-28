import { prisma } from "@/lib/prisma";
import { listVMs, type VcPowerState } from "@/lib/vcenter";
import { sendInfraPowerNotification, sendVmPowerNotifications } from "@/lib/mailer";

let running = false;

function monitoredAction(state: VcPowerState) {
  if (state === "POWERED_ON") return "POWER_ON" as const;
  if (state === "POWERED_OFF") return "POWER_OFF" as const;
  return null;
}

export async function pollVCenterPowerStates() {
  if (running) return;
  running = true;
  try {
    const settings = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
    if (!settings?.vcenterMonitorEnabled || !settings.vcenterHost || !settings.vcenterUser || !settings.vcenterPass) return;

    const intervalMs = settings.vcenterMonitorIntervalSeconds * 1000;
    if (settings.vcenterMonitorLastRunAt && Date.now() - settings.vcenterMonitorLastRunAt.getTime() < intervalMs) return;
    await prisma.siteSettings.update({ where: { id: "singleton" }, data: { vcenterMonitorLastRunAt: new Date() } });

    const [remoteVMs, localVMs] = await Promise.all([
      listVMs(),
      prisma.vM.findMany({ select: { id: true, vcenterVmId: true, name: true, isInfra: true, lastPowerState: true, lastPowerCommandAt: true } }),
    ]);
    const remoteById = new Map(remoteVMs.map(vm => [vm.vm, vm.power_state]));

    for (const vm of localVMs) {
      const state = remoteById.get(vm.vcenterVmId);
      if (!state) continue;
      const changed = vm.lastPowerState !== null && vm.lastPowerState !== state;
      const commandGraceMs = Math.max(intervalMs * 2, 10 * 60_000);
      const followsRecentPanelCommand = Boolean(vm.lastPowerCommandAt && Date.now() - vm.lastPowerCommandAt.getTime() < commandGraceMs);

      await prisma.vM.update({
        where: { id: vm.id },
        data: { lastPowerState: state, lastPowerCheckedAt: new Date(), lastPowerCommandAt: followsRecentPanelCommand ? vm.lastPowerCommandAt : null },
      });

      const action = monitoredAction(state);
      if (!changed || !action || followsRecentPanelCommand) continue;
      if (vm.isInfra) {
        await sendInfraPowerNotification(vm.name, action, "vCenter");
      } else {
        await sendVmPowerNotifications(vm.id, vm.name, action, "vCenter");
      }
    }
  } catch (error) {
    console.error("[vcenter-monitor] polling failed", error);
  } finally {
    running = false;
  }
}

export function startVCenterMonitor() {
  const globalState = globalThis as typeof globalThis & { __vcenterMonitorTimer?: ReturnType<typeof setInterval> };
  if (globalState.__vcenterMonitorTimer) return;
  void pollVCenterPowerStates();
  globalState.__vcenterMonitorTimer = setInterval(() => void pollVCenterPowerStates(), 30_000);
  globalState.__vcenterMonitorTimer.unref?.();
}
