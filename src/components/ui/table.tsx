import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Table({ caption, className, children, ...props }: TableHTMLAttributes<HTMLTableElement> & { caption?: string; children?: ReactNode }) {
  return <div className="table-scroll"><table className={cn("data-table", className)} {...props}>{caption && <caption className="sr-only">{caption}</caption>}{children}</table></div>;
}
export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <thead className={cn("data-table__head", className)} {...props} />; }
export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <tbody className={cn("data-table__body", className)} {...props} />; }
export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) { return <tr className={cn("data-table__row", className)} {...props} />; }
export function TableHeaderCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) { return <th className={cn("data-table__header-cell", className)} {...props} />; }
export function TableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) { return <td className={cn("data-table__cell", className)} {...props} />; }
export function TableEmpty({ children, colSpan = 1 }: { children?: ReactNode; colSpan?: number }) { return <tr><td className="data-table__empty" colSpan={colSpan}>{children}</td></tr>; }
