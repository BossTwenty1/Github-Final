import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return <main className="admin-login-page"><div className="admin-login-card"><BrandLockup /><Card><CardContent><div className="unauthorized-card"><h1>Administrator access unavailable</h1><p>Your account is not an active ADMIN or MANAGER account. Contact an active ADMIN if your access should be restored.</p><Alert icon="shield" title="Permission check enforced" variant="warning">This page is shown for pending, suspended, revoked, inactive, or unassigned accounts.</Alert><Link href="/admin/login"><Button className="button--full" size="lg">Return to sign in</Button></Link></div></CardContent></Card></div></main>;
}
