import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useGetMe } from "@workspace/api-client-react";

const SESSION_KEY = "fsm_admin_active_dept";

interface DepartmentContextValue {
  isAdmin: boolean;
  userDeptId: number | null;
  activeDeptId: number | undefined;
  setActiveDeptId: (id: number | undefined) => void;
}

const DepartmentContext = createContext<DepartmentContextValue>({
  isAdmin: false,
  userDeptId: null,
  activeDeptId: undefined,
  setActiveDeptId: () => {},
});

function readPersistedDeptId(): number | undefined {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw === null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

function persistDeptId(id: number | undefined) {
  try {
    if (id == null) {
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, String(id));
    }
  } catch {
    // sessionStorage unavailable (private-mode edge cases) — ignore
  }
}

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const { data } = useGetMe();
  const user = data?.user;
  const isAdmin = user?.role === "ADMIN";
  const userDeptId = user?.departmentId ?? null;

  const [adminSelectedDeptId, setAdminSelectedDeptIdRaw] = useState<number | undefined>(
    readPersistedDeptId,
  );

  const setAdminSelectedDeptId = (id: number | undefined) => {
    setAdminSelectedDeptIdRaw(id);
    persistDeptId(id);
  };

  // Sync to sessionStorage whenever the value changes from outside (e.g. initial load)
  useEffect(() => {
    if (isAdmin) persistDeptId(adminSelectedDeptId);
  }, [isAdmin, adminSelectedDeptId]);

  const activeDeptId = isAdmin ? adminSelectedDeptId : (userDeptId ?? undefined);

  return (
    <DepartmentContext.Provider
      value={{
        isAdmin,
        userDeptId,
        activeDeptId,
        setActiveDeptId: isAdmin ? setAdminSelectedDeptId : () => {},
      }}
    >
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartmentFilter() {
  return useContext(DepartmentContext);
}
