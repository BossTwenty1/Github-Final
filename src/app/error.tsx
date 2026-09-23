"use client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
export default function DataError({ reset }: { reset: () => void }) {
  return <main className="visitor-stack"><Alert title="Temporarily unavailable" variant="danger">We could not load this page. Check your connection and try again.</Alert><Button onClick={reset}>Try again</Button></main>;
}
