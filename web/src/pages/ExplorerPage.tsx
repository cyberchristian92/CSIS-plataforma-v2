import { useParams } from "react-router-dom";
import { FileExplorer } from "@/components/FileExplorer";

export default function ExplorerPage() {
  const { projetoId = "" } = useParams();
  return (
    <div className="p-6">
      <FileExplorer scope={{ type: "projeto", id: projetoId }} />
    </div>
  );
}
