import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) { return <section className={cn("card", className)} {...props} />; }
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("card-header", className)} {...props} />; }
export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }) { return <h2 className={cn("card-title", className)} {...props}>{children}</h2>; }
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("card-content", className)} {...props} />; }
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("card-footer", className)} {...props} />; }
