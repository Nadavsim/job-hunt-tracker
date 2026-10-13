import { useState } from "react";
import { groupByStage } from "../lib/applications";
import { formatDate } from "../lib/dates";
import { STAGE_LABELS } from "../lib/labels";
import { STAGES, type Application, type Stage } from "../lib/types";
import { StageSelect } from "./StageSelect";

interface Props {
  applications: Application[];
  onMove: (app: Application, stage: Stage) => void;
  onOpen: (app: Application) => void;
}

/**
 * One column per stage. Moving a card: drag it to another column (mouse), or
 * use the stage dropdown on the card (keyboard / touch - the required path).
 */
export function KanbanBoard({ applications, onMove, onOpen }: Props) {
  const groups = groupByStage(applications);
  const [dragOver, setDragOver] = useState<Stage | null>(null);

  function drop(stage: Stage, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    const app = applications.find((a) => a.id === id);
    if (app && app.stage !== stage) onMove(app, stage);
  }

  return (
    <div className="board">
      {STAGES.map((stage) => (
        <section
          key={stage}
          className={`column${dragOver === stage ? " drag-over" : ""}`}
          aria-label={STAGE_LABELS[stage]}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(stage);
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => drop(stage, e)}
        >
          <h3>
            {STAGE_LABELS[stage]} <span className="count">{groups[stage].length}</span>
          </h3>
          {groups[stage].map((app) => (
            <article
              key={app.id}
              className={`card${app.is_stale ? " stale" : ""}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(app.id))}
            >
              <button type="button" className="link card-title" onClick={() => onOpen(app)}>
                {app.company}
              </button>
              <div className="muted small">{app.role}</div>
              <div className="muted small">
                {app.date_applied ? `Applied ${formatDate(app.date_applied)}` : "Not applied yet"}
                {app.is_stale && <span className="badge warn"> {app.days_in_stage}d, no reply</span>}
              </div>
              <StageSelect
                label={`Stage for ${app.company}`}
                value={app.stage}
                onChange={(s) => onMove(app, s)}
              />
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
