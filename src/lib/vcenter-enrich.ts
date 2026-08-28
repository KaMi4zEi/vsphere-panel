// src/lib/vcenter-enrich.ts
// Helper pour enrichir les données d'une VM depuis vCenter (OS, disques, config)
import { getVMDetail, getVMGuest } from "@/lib/vcenter";


// Mapping des enums vSphere vers des noms lisibles
// vSphere utilise des enums historiques qui ne correspondent pas aux noms réels des OS
function mapGuestOS(guestOS: string): string {
  const map: Record<string, string> = {
    // Windows Desktop
    "WINDOWS_9":            "Windows 10",
    "WINDOWS_9_64":         "Windows 10/11 (64-bit)",
    "WINDOWS_9_SERVER_64":  "Windows Server (64-bit)",
    "WINDOWS_8":            "Windows 8",
    "WINDOWS_8_64":         "Windows 8.1 (64-bit)",
    "WINDOWS_7":            "Windows 7",
    "WINDOWS_7_64":         "Windows 7 (64-bit)",
    "WINDOWS_VISTA_64":     "Windows Vista (64-bit)",
    "WIN_XP_PRO":           "Windows XP",
    "WIN_XP_PRO_64":        "Windows XP (64-bit)",
    // Windows Server
    "WINDOWS_SERVER_2025":  "Windows Server 2025",
    "WINDOWS_SERVER_2022":  "Windows Server 2022",
    "WINDOWS_SERVER_2019":  "Windows Server 2019",
    "WINDOWS_SERVER_2016":  "Windows Server 2016",
    "WINDOWS_SERVER_2012":  "Windows Server 2012",
    "WINDOWS_SERVER_2008":  "Windows Server 2008",
    "WIN_2000_SERV":        "Windows 2000 Server",
    // Linux
    "UBUNTU_64":            "Ubuntu (64-bit)",
    "UBUNTU":               "Ubuntu",
    "DEBIAN_10_64":         "Debian 10 (64-bit)",
    "DEBIAN_11_64":         "Debian 11 (64-bit)",
    "DEBIAN_12_64":         "Debian 12 (64-bit)",
    "RHEL_9_64":            "Red Hat Enterprise Linux 9",
    "RHEL_8_64":            "Red Hat Enterprise Linux 8",
    "CENTOS_8_64":          "CentOS 8 (64-bit)",
    "CENTOS_7_64":          "CentOS 7 (64-bit)",
    "SLES_15_64":           "SUSE Linux Enterprise 15",
    "ORACLE_LINUX_8_64":    "Oracle Linux 8",
    "ROCKY_LINUX_64":       "Rocky Linux",
    "ALMA_LINUX_64":        "AlmaLinux",
    "OTHER_LINUX_64":       "Linux (64-bit)",
    "OTHER_LINUX":          "Linux",
    // Autres
    "OTHER_GUEST_64":       "Autre OS (64-bit)",
    "OTHER_GUEST":          "Autre OS",
    "DARWIN":               "macOS",
    "DARWIN_64":            "macOS (64-bit)",
    "FREEBSD_64":           "FreeBSD (64-bit)",
  };

  if (map[guestOS]) return map[guestOS];

  // Fallback: formatage générique
  return guestOS
    .replace(/_64$/, " (64-bit)")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}

export interface VMEnrichedData {
  os: string;
  vcpu: number;
  ramGb: number;
  diskCount: number;
  diskTotalGb: number;
}

export async function enrichVMFromVCenter(vcenterVmId: string, baseCpuCount: number, baseMemMiB: number): Promise<VMEnrichedData> {
  let os = "";
  let diskCount = 0;
  let diskTotalGb = 0;
  let vcpu = baseCpuCount;
  let ramGb = Math.round(baseMemMiB / 1024);

  try {
    const detail = await getVMDetail(vcenterVmId);

    // CPU et RAM depuis le detail (plus précis)
    if (detail.cpu?.count) vcpu = detail.cpu.count;
    if (detail.memory?.size_MiB) ramGb = Math.round(detail.memory.size_MiB / 1024);

    // OS depuis guest_OS (enum vSphere) — mapping vers noms réels
    if (detail.guest_OS) {
      os = mapGuestOS(detail.guest_OS);
    }

    // Disques — capacity directement en bytes
    if (detail.disks) {
      const disksArr = Object.values(detail.disks) as any[];
      diskCount = disksArr.length;
      diskTotalGb = disksArr.reduce((sum: number, d: any) => {
        const cap = d.capacity ?? d.value?.capacity ?? 0;
        return sum + cap / (1024 ** 3);
      }, 0);
      diskTotalGb = Math.round(diskTotalGb * 10) / 10;
    }
  } catch {}

  // Fallback OS via guest/identity si pas trouvé
  if (!os) {
    try {
      const guest = await getVMGuest(vcenterVmId);
      if (guest.os_fullname) os = guest.os_fullname;
    } catch {}
  }

  return { os, vcpu, ramGb, diskCount, diskTotalGb };
}
