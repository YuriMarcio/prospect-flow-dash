import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listObjectiveColumns, listObjectives } from "@/lib/objectives";
import { applyDerivedProgress } from "@/lib/objectiveTree";
import { useObjectivesStore } from "@/store/objectives";

export function useObjectivesSync() {
  const setColumns = useObjectivesStore((state) => state.setColumns);
  const setObjectives = useObjectivesStore((state) => state.setObjectives);

  const columnsQuery = useQuery({
    queryKey: ["objective-columns"],
    queryFn: listObjectiveColumns,
    retry: 1,
  });

  const objectivesQuery = useQuery({
    queryKey: ["objectives"],
    queryFn: listObjectives,
    retry: 1,
  });

  useEffect(() => {
    if (columnsQuery.data) setColumns(columnsQuery.data);
  }, [columnsQuery.data, setColumns]);

  useEffect(() => {
    // Progresso derivado da árvore aplicado já na entrada: marcar/desmarcar um item
    // atualiza o percentual dos ancestrais na hora, sem esperar o servidor recalcular.
    if (objectivesQuery.data) setObjectives(applyDerivedProgress(objectivesQuery.data));
  }, [objectivesQuery.data, setObjectives]);

  return { columnsQuery, objectivesQuery };
}
