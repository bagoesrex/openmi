import { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { LoginView } from "./components/LoginView";
import { AccountCard } from "./components/AccountCard";
import { AccountModal } from "./components/AccountModal";
import { LogTerminal } from "./components/LogTerminal";
import { useAuth } from "./hooks/useAuth";
import { useSSE } from "./hooks/useSSE";
import type { Account, NewAccountInput } from "./types";
import {
  fetchAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  testAccountConnection,
} from "./lib/api";
import { Plus, Users, Cpu } from "lucide-react";

export function App() {
  const { token, isAuthenticated, loading: authLoading, error: authError, login, logout } = useAuth();
  const { logs, isConnected: isSseConnected, clearLogs } = useSSE(token);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!token) return;
    setLoadingAccounts(true);
    try {
      const data = await fetchAccounts();
      setAccounts(data);
    } catch (err: any) {
      if (err?.message === "UNAUTHORIZED") {
        logout();
      }
    } finally {
      setLoadingAccounts(false);
    }
  }, [token, logout]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAccounts();
    }
  }, [isAuthenticated, loadAccounts]);

  const handleCreateOrUpdateAccount = async (input: NewAccountInput) => {
    if (editingAccount) {
      const updated = await updateAccount(editingAccount.id, input);
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } else {
      const created = await createAccount(input);
      setAccounts((prev) => [...prev, created]);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Are you sure you want to remove this account?")) return;
    try {
      await deleteAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert("Failed to delete account: " + err.message);
    }
  };

  const handleToggleAutoApply = async (id: string, enabled: boolean) => {
    try {
      const updated = await updateAccount(id, { autoApplyEnabled: enabled });
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err: any) {
      alert("Failed to toggle auto-apply: " + err.message);
    }
  };

  const handleTestConnection = async (id: string) => {
    const res = await testAccountConnection(id);
    // Refresh accounts to reflect updated session status
    loadAccounts();
    return res;
  };

  if (!isAuthenticated) {
    return <LoginView onLogin={login} loading={authLoading} error={authError} />;
  }

  const activeAccountsCount = accounts.filter((a) => a.autoApplyEnabled === 1).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        isSseConnected={isSseConnected}
        onLogout={logout}
        onRefresh={loadAccounts}
        isRefreshing={loadingAccounts}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Account Management (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-500" />
                  Managed Xiaomi Accounts
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {accounts.length} registered • {activeAccountsCount} armed for 23:00 WIB
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingAccount(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-orange-600/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Account</span>
              </button>
            </div>

            {/* Account Cards Grid */}
            {accounts.length === 0 ? (
              <div className="border border-dashed border-slate-800 rounded-xl p-10 text-center text-slate-500 bg-slate-900/40">
                <Cpu className="w-10 h-10 mx-auto mb-3 opacity-40 text-orange-400" />
                <h3 className="text-sm font-semibold text-slate-300">No Xiaomi accounts added</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Click "Add Account" above to register your first cUserId and serviceToken cookie.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map((acc) => (
                  <AccountCard
                    key={acc.id}
                    account={acc}
                    onEdit={(account) => {
                      setEditingAccount(account);
                      setIsModalOpen(true);
                    }}
                    onDelete={handleDeleteAccount}
                    onToggleAutoApply={handleToggleAutoApply}
                    onTestConnection={handleTestConnection}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Live Terminal Stream (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <LogTerminal logs={logs} onClear={clearLogs} />
          </div>
        </div>
      </main>

      <AccountModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAccount(null);
        }}
        onSubmit={handleCreateOrUpdateAccount}
        initialAccount={editingAccount}
      />
    </div>
  );
}

export default App;
