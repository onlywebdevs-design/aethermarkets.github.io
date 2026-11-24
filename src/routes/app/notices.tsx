import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gate, usePortal } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/field";
import { listNotices, markAllNoticesRead, markNoticeRead } from "@/lib/fns";
import { errText, formatWhen } from "@/lib/money";
import type { Notice } from "@/lib/types";

export const Route = createFileRoute("/app/notices")({ component: Page });

function Page() {
  return (
    <Gate>
      <Body />
    </Gate>
  );
}

function Body() {
  const { reload } = usePortal();
  const [rows, setRows] = useState<Notice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    void listNotices()
      .then(setRows)
      .catch((err: unknown) => setError(errText(err)));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Notices</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            void markAllNoticesRead().then(() => {
              load();
              reload();
            })
          }
        >
          Mark all read
        </Button>
      </div>
      {error ? <p className="text-sm text-sell">{error}</p> : null}
      <div className="space-y-3">
        {rows?.length === 0 ? <p className="text-sm text-muted">No notices.</p> : null}
        {rows?.map((row) => (
          <Panel key={row.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.title}</p>
                <p className="mt-1 text-sm text-muted">{row.body}</p>
                <p className="mt-2 text-xs text-muted">{formatWhen(row.createdAt)}</p>
              </div>
              {row.readAt == null ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void markNoticeRead({ data: row.id }).then(() => {
                      load();
                      reload();
                    })
                  }
                >
                  Read
                </Button>
              ) : null}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
