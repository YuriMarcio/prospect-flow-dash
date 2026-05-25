import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listLeads } from "@/lib/api";
import { useKanbanStore } from "@/store/kanban";

export function useLeadsSync() {
  const setLeads = useKanbanStore((state) => state.setLeads);

  const query = useQuery({
    queryKey: ["leads"],
    queryFn: listLeads,
    retry: 1,
  });

  useEffect(() => {
    if (query.data) setLeads(query.data);
  }, [query.data, setLeads]);

  return query;
}
