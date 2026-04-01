import { useOutletContext } from "react-router-dom";
import type { AppLayoutContext } from "../components/AppLayout";
import { DocWriterView } from "../components/DocWriterView";

export default function DocWriterPage() {
  const ctx = useOutletContext<AppLayoutContext | undefined>();
  const config = ctx?.savedConfig ?? null;
  return <DocWriterView config={config} />;
}
