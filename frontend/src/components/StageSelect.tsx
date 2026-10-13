import { STAGE_LABELS } from "../lib/labels";
import { STAGES, type Stage } from "../lib/types";

interface Props {
  value: Stage;
  onChange: (stage: Stage) => void;
  label: string;
}

export function StageSelect({ value, onChange, label }: Props) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as Stage)}>
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {STAGE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
