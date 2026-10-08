"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiJson, jsonBody } from "@/lib/api";
export interface User {
  id: string;
  email: string;
  name: string;
  role: "member" | "admin";
  created_at: number;
}
const Context = createContext<{
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  loading: true,
  error: "",
  refresh: async () => {},
  logout: async () => {},
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const data = await apiJson<{ user: User | null }>("/api/auth/me");
      setUser(data.user);
      setError("");
    } catch {
      setError("暂时无法连接服务，请确认本地服务已启动");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let live = true;
    void apiJson<{ user: User | null }>("/api/auth/me")
      .then((data) => {
        if (live) setUser(data.user);
      })
      .catch(() => {
        if (live) setError("暂时无法连接服务，请确认本地服务已启动");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  async function logout() {
    await apiJson("/api/auth/logout", jsonBody("POST", {}));
    setUser(null);
  }
  return (
    <Context.Provider value={{ user, loading, error, refresh, logout }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
