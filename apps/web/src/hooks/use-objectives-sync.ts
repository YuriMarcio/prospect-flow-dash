import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listObjectiveColumns, listObjectives } from "@/lib/objectives";
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
    if (objectivesQuery.data) setObjectives(objectivesQuery.data);
  }, [objectivesQuery.data, setObjectives]);

  return { columnsQuery, objectivesQuery };
}
