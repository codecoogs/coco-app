"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/shadcn/dialog";
import { Button } from "@/app/components/ui/shadcn/button";
import { useRouter } from "next/navigation";

export type CheckInOutcome =
  | "ok"
  | "already"
  | "expired"
  | "closed"
  | "invalid"
  | "error";

type Props = {
  outcome: CheckInOutcome;
  eventTitle: string | null;
  /** Non-members are told their points are waiting on a membership. */
  pendingPoints: boolean;
};

function message(
  outcome: CheckInOutcome,
  eventTitle: string | null,
  pendingPoints: boolean
): { title: string; body: string } {
  const event = eventTitle ? `"${eventTitle}"` : "the event";
  switch (outcome) {
    case "ok":
      return {
        title: "You're checked in",
        body: pendingPoints
          ? `Thank you for attending ${event}. Your attendance is recorded, and your points are held as pending until you buy a membership.`
          : `Thank you for attending ${event}. Your attendance and points have been recorded.`,
      };
    case "already":
      return {
        title: "Already checked in",
        body: `You were already checked in to ${event}. No need to scan again.`,
      };
    case "expired":
      return {
        title: "That code expired",
        body: "The check-in code refreshes every few seconds. Scan the code on the screen again.",
      };
    case "closed":
      return {
        title: "Check-in is closed",
        body: `${eventTitle ? `"${eventTitle}"` : "That event"} is not running right now, so check-in is closed.`,
      };
    case "invalid":
      return {
        title: "Check-in link not recognized",
        body: "That link does not point at an event. Scan the code on the screen again.",
      };
    case "error":
      return {
        title: "Check-in failed",
        body: "Something went wrong recording your attendance. Let an officer know.",
      };
  }
}

export function CheckInResultModal({ outcome, eventTitle, pendingPoints }: Props) {
  const router = useRouter();
  const { title, body } = message(outcome, eventTitle, pendingPoints);

  // Drops the ?checkin= params so a refresh does not reopen the modal.
  const close = () => router.replace("/dashboard");

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={close}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
