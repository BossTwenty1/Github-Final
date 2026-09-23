import { Icon } from "@/components/ui/icons";

type BrandLockupProps = { admin?: boolean; compact?: boolean };

export function BrandLockup({ admin = false, compact = false }: BrandLockupProps) {
  return (
    <div className={`brand-lockup ${compact ? "brand-lockup--compact" : ""}`}>
      <span className="brand-mark"><Icon name="tree" size={compact ? 18 : 21} strokeWidth={1.7} /></span>
      <span className="brand-lockup__text">
        <span className="brand-name">GraveNav{admin ? " Admin" : ""}{compact && !admin ? <span className="brand-status" aria-hidden="true" /> : null}</span>
        {(admin || compact) && <span className="brand-subtitle">{admin ? "Cemetery Management" : "Forest Lake Park"}</span>}
      </span>
    </div>
  );
}
