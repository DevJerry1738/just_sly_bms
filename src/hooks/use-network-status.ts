import { useEffect, useState } from "react";
import { NetworkStatusService } from "@/services/offline/network-status";
import type { NetworkStatusState } from "@/services/sync/types";

export function useNetworkStatus(): NetworkStatusState {
  const [state, setState] = useState<NetworkStatusState>(() => NetworkStatusService.getState());

  useEffect(() => {
    return NetworkStatusService.subscribe((newState) => {
      setState(newState);
    });
  }, []);

  return state;
}
