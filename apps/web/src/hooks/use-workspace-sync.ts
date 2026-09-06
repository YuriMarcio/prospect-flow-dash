import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listWorkspacePages } from "@/lib/workspaceApi";
import { useWorkspaceStore } from "@/store/workspace";

export function useWorkspaceSync() {
  const setPages = useWorkspaceStore((state) => state.setPages);

  const query = useQuery({
    queryKey: ["workspace-pages"],
    queryFn: listWorkspacePages,
    retry: 1,
  });

  useEffect(() => {
    if (query.data) setPages(query.data);
  }, [query.data, setPages]);

  return query;
}
