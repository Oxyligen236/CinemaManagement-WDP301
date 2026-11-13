export interface BranchInfo {
  branchId: string;
  branchName: string;
  address?: string;
  hotline?: string;
  branchStatus?: string;
}

const branchCache = new Map<string, BranchInfo>();

const FALLBACK_SLUGS: Record<string, { name: string; address?: string }> = {
  "branch-cantavil": {
    name: "Latte Cinema Cantavil",
    address: "Tầng 7, Cantavil Premier, An Phú, TP. Thủ Đức",
  },
  "branch-govap": {
    name: "Latte Cinema Gò Vấp",
    address: "Tầng 3, Lotte Mart, Nguyễn Văn Lượng, Gò Vấp, TP.HCM",
  },
  "branch-nam-sai-gon": {
    name: "Latte Cinema Nam Sài Gòn",
    address: "Tầng 3, TTTM Lotte Mart, Q.7, TP.HCM",
  },
  "branch-landmark": {
    name: "Latte Cinema Landmark Hà Nội",
    address: "Tầng 5, Keangnam Landmark Tower, Cầu Giấy, Hà Nội",
  },
};

export async function fetchBranchInfo(
  branchId: string,
): Promise<BranchInfo | null> {
  if (!branchId) return null;

  if (branchCache.has(branchId)) {
    return branchCache.get(branchId)!;
  }

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010";

  // 1. Try GET /branches/:branchId
  try {
    const res = await fetch(
      `${API_BASE_URL}/branches/${encodeURIComponent(branchId)}`,
      {
        cache: "no-store",
      },
    );
    if (res.ok) {
      const data = await res.json();
      const b = data?.branch || data;
      const rawName = b?.branchName || b?.name;
      if (rawName) {
        const info: BranchInfo = {
          branchId,
          branchName: String(rawName).replace(/Lotte/gi, "Latte"),
          address: b.address
            ? String(b.address).replace(/Lotte/gi, "Latte")
            : undefined,
          hotline: b.hotline ? String(b.hotline) : undefined,
          branchStatus: b.branchStatus ? String(b.branchStatus) : undefined,
        };
        branchCache.set(branchId, info);
        return info;
      }
    }
  } catch {
    // Continue to fallback
  }

  // 2. Try GET /branches/public
  try {
    const res = await fetch(`${API_BASE_URL}/branches/public`, {
      cache: "no-store",
    });
    if (res.ok) {
      const list = await res.json();
      const arr = Array.isArray(list)
        ? list
        : Array.isArray(list?.branches)
          ? list.branches
          : [];
      for (const item of arr) {
        const id = item.id || item._id || item.branchId;
        const rawName = item.branchName || item.name;
        if (id && rawName) {
          const info: BranchInfo = {
            branchId: String(id),
            branchName: String(rawName).replace(/Lotte/gi, "Latte"),
            address: item.address
              ? String(item.address).replace(/Lotte/gi, "Latte")
              : undefined,
            hotline: item.hotline ? String(item.hotline) : undefined,
            branchStatus: item.branchStatus
              ? String(item.branchStatus)
              : undefined,
          };
          branchCache.set(String(id), info);
        }
      }
      if (branchCache.has(branchId)) {
        return branchCache.get(branchId)!;
      }
    }
  } catch {
    // Continue to fallback
  }

  // 3. Fallback to known slug mapping
  if (FALLBACK_SLUGS[branchId]) {
    const info: BranchInfo = {
      branchId,
      branchName: FALLBACK_SLUGS[branchId].name,
      address: FALLBACK_SLUGS[branchId].address,
    };
    branchCache.set(branchId, info);
    return info;
  }

  return null;
}
