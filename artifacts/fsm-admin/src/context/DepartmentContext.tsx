import { createContext, useContext, useState, type ReactNode } from "react";
import { useGetMe } from "@workspace/api-client-react";

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

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const { data } = useGetMe();
  const user = data?.user;
  const isAdmin = user?.role === "ADMIN";
  const userDeptId = user?.departmentId ?? null;

  const [adminSelectedDeptId, setAdminSelectedDeptId] = useState<number | undefined>(undefined);

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
