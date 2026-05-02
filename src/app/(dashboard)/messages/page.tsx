"use client";

import { MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MessagesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Customer chat inbox.
          </p>
        </div>
        <Badge variant="secondary">Coming Soon</Badge>
      </div>
      <div className="grid h-[60vh] gap-3 rounded-lg border md:grid-cols-[260px_1fr]">
        <Card className="m-2 flex flex-col gap-2 p-2">
          <div className="rounded-md bg-muted/40 p-2 text-xs font-semibold uppercase tracking-wide">
            Conversations
          </div>
          <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
            No active chats
          </div>
        </Card>
        <Card className="m-2 flex flex-col items-center justify-center gap-2 p-8 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
          <h3 className="text-sm font-semibold">No active chats — coming soon</h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            Customer chat lives in v2. The data model is already in place — when
            we wire the WebSocket layer, this view will become live.
          </p>
        </Card>
      </div>
    </div>
  );
}
