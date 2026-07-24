import Image from "next/image";
import type { AppRole } from "@/lib/data/types";
import type { NavItem, ModuleKey } from "@/lib/domain/vocabulary";
import { NAV_GROUP_LABEL, NAV_ITEM_GROUP, ROLE_LABEL } from "@/lib/domain/vocabulary";
import { CentreSwitcher } from "./CentreSwitcher";
import { LogoutButton } from "./LogoutButton";
import { NavLink } from "./NavLink";
import {
  GridIcon,
  CheckSquareIcon,
  TrendingUpIcon,
  MountainIcon,
  FileIcon,
  CheckCircleIcon,
  CalendarIcon,
  ChartIcon,
} from "./nav-icons";

const NAV_ICON: Record<ModuleKey, React.ReactNode> = {
  tasks: <CheckSquareIcon />,
  performance: <TrendingUpIcon />,
  roadmap: <MountainIcon />,
  calendar: <CalendarIcon />,
  hrRequests: <FileIcon />,
  hrApprovals: <CheckCircleIcon />,
  hrTimetable: <CalendarIcon />,
  hrReports: <ChartIcon />,
};

interface CentreOption {
  id: string;
  name: string;
}

interface SidebarProps {
  items: readonly NavItem[];
  centres: CentreOption[];
  showCentreSwitcher: boolean;
  role: AppRole;
  fullName: string;
  approvalCount: number;
}

/** The navy-gradient app shell sidebar (design_handoff_jax_sales). Groups nav into "Chung"/"Nhân
 *  sự" per NAV_ITEM_GROUP, same NAV_ITEMS list that governs actual route access (FR-009) — no
 *  parallel nav definition. */
export function Sidebar({ items, centres, showCentreSwitcher, role, fullName, approvalCount }: SidebarProps) {
  const groups = (Object.keys(NAV_GROUP_LABEL) as (keyof typeof NAV_GROUP_LABEL)[]).map((groupKey) => ({
    key: groupKey,
    title: NAV_GROUP_LABEL[groupKey],
    items: items.filter((item) => NAV_ITEM_GROUP[item.key] === groupKey),
  })).filter((group) => group.items.length > 0);

  const initials = fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <aside
      className="flex w-[264px] shrink-0 flex-col border-r text-sidebar-text"
      style={{ background: "var(--sidebar-grad)", borderColor: "var(--color-sidebar-border)" }}
    >
      <div className="px-4 pb-3.5 pt-[18px]">
        <div className="flex items-center gap-[11px]">
          <div className="flex items-center rounded-[9px] bg-white px-[9px] py-[7px] shadow-[0_2px_6px_rgba(0,0,0,.25)]">
            <Image src="/brand/jaxtina-logo.png" alt="Jaxtina English" height={22} width={90} className="h-[22px] w-auto" />
          </div>
          <div className="leading-[1.1]">
            <div className="font-display text-[17px] font-extrabold tracking-[.01em] text-white">jax-sales</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[.16em] text-sidebar-text opacity-70">Vận hành nội bộ</div>
          </div>
        </div>
      </div>

      {showCentreSwitcher && <CentreSwitcher centres={centres} />}

      <nav className="flex-1 overflow-y-auto px-2.5 pb-2.5 pt-1">
        {groups.map((group) => (
          <div key={group.key} className="mb-4">
            <div className="px-3 pb-[7px] pt-1 text-[10px] font-bold uppercase tracking-[.11em] text-sidebar-text opacity-55">
              {group.title}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.key}
                href={item.route}
                label={item.label}
                icon={NAV_ICON[item.key]}
                count={item.key === "hrApprovals" ? approvalCount : undefined}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t p-3" style={{ borderColor: "var(--color-sidebar-border)" }}>
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-red text-[13px] font-bold text-white">
            {initials || "?"}
          </span>
          <span className="min-w-0 flex-1 leading-[1.25]">
            <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-white">
              {fullName}
            </span>
            <span className="block text-[11px] text-sidebar-text opacity-80">{ROLE_LABEL[role]}</span>
          </span>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
