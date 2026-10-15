/**
 * GroupSelectModal.jsx
 *
 * Shown BEFORE the AddEmailAccount modal.
 * The user either picks an existing group or creates a new one.
 * On confirm → parent opens AddEmailAccount with { groupId, groupName, isFull }.
 *
 * Limits (enforced on the server too):
 *   • 70 mail accounts per user
 *   •  8 mail accounts per group
 *
 * Full groups (8/8) can still be OPENED — inside, the user can remove an
 * account and then add a replacement. Adding a 9th account is blocked in
 * AddEmailAccount and on the server.
 */

import React, { useEffect, useState } from "react";
import { Folder, Plus, X, Check, Info } from "lucide-react";
import { api } from "../../utils/api";

// ✅ Mail-account limits (server enforces the same numbers)
const MAX_ACCOUNTS_PER_USER = 70;
const MAX_ACCOUNTS_PER_GROUP = 8;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const GROUP_COLORS = [
  "#10b981", // emerald
  "#0ea5e9", // sky
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#84cc16", // lime
];

export default function GroupSelectModal({ groups: groupsProp = [], onConfirm, onClose, onGroupsChange }) {
  const [groups, setGroups] = useState(groupsProp);
  const [limits, setLimits] = useState({
    totalAccounts: 0,
    maxAccounts: MAX_ACCOUNTS_PER_USER,
    maxPerGroup: MAX_ACCOUNTS_PER_GROUP,
  });
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [isCreating, setIsCreating] = useState(groupsProp.length === 0);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Always load fresh counts when the picker opens
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get(`${API_BASE_URL}/api/account-groups`);
        if (!alive) return;
        const data = Array.isArray(res.data?.data) ? res.data.data : [];
        setGroups(data);
        if (res.data?.limits) setLimits((l) => ({ ...l, ...res.data.limits }));
        if (data.length === 0) setIsCreating(true);
      } catch (err) {
        console.error("Failed to load group counts:", err);
      }
    })();
    return () => { alive = false; };
  }, []);

  const maxAccounts = limits.maxAccounts || MAX_ACCOUNTS_PER_USER;
  const maxPerGroup = limits.maxPerGroup || MAX_ACCOUNTS_PER_GROUP;
  const totalUsed = limits.totalAccounts || 0;
  const remaining = Math.max(maxAccounts - totalUsed, 0);
  const userLimitReached = totalUsed >= maxAccounts;

  const countOf = (g) => g.accountCount ?? 0;
  const isGroupFull = (g) => countOf(g) >= maxPerGroup;

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;
  const selectedIsFull = !!selectedGroup && isGroupFull(selectedGroup);

  // Full groups stay selectable — they can be opened to manage/replace accounts.
  const handleSelectExisting = (group) => {
    setError("");
    setSelectedGroupId(group.id);
    setIsCreating(false);
  };

  const handleCreateAndProceed = async () => {
    if (userLimitReached) {
      setError(`You have reached the maximum of ${maxAccounts} mail accounts. Remove an account before creating a new group.`);
      return;
    }
    if (!newGroupName.trim()) {
      setError("Please enter a group name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.post(`${API_BASE_URL}/api/account-groups`, {
        name: newGroupName.trim(),
        color: newGroupColor,
      });
      const created = res.data?.data;
      if (onGroupsChange) await onGroupsChange();
      onConfirm({ groupId: created.id, groupName: created.name, isFull: false });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create group.");
    } finally {
      setSaving(false);
    }
  };

  // Opening a group is always allowed (even when the group or the user limit
  // is full) so accounts inside can be viewed, removed and replaced.
  const handleSelectAndProceed = () => {
    if (!selectedGroup) { setError("Please select a group."); return; }
    onConfirm({
      groupId: selectedGroup.id,
      groupName: selectedGroup.name,
      isFull: isGroupFull(selectedGroup),
    });
  };

  const usagePct = Math.min(100, (totalUsed / maxAccounts) * 100);
  const usageBarColor =
    userLimitReached ? "bg-red-500" : totalUsed >= maxAccounts - 10 ? "bg-amber-500" : "bg-emerald-500";

  const continueDisabled =
    saving ||
    (isCreating ? !newGroupName.trim() || userLimitReached : !selectedGroupId);

  const continueLabel = saving
    ? "Creating…"
    : isCreating
    ? "Create & Continue"
    : selectedIsFull
    ? "Open Group →"
    : "Continue →";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-green-500 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Choose a Group</h2>
            <p className="text-emerald-50 text-sm mt-0.5">
              Organise your email account into a group
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6">
          {/* ── Mail account usage (70 per user) ── */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Mail Accounts
              </p>
              <p className={`text-xs font-semibold ${userLimitReached ? "text-red-600" : "text-slate-500"}`}>
                {totalUsed} / {maxAccounts} used
              </p>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${usageBarColor} transition-all`} style={{ width: `${usagePct}%` }} />
            </div>
            <p className={`text-[11px] mt-1.5 ${userLimitReached ? "text-red-600 font-semibold" : "text-slate-400"}`}>
              {userLimitReached
                ? "Limit reached — open a group and remove an account to add a new one."
                : `${remaining} account${remaining === 1 ? "" : "s"} remaining`}
            </p>
          </div>

          {/* Existing groups */}
          {groups.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Existing Groups
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {groups.map((group) => {
                  const count = countOf(group);
                  const full = isGroupFull(group);
                  const selected = selectedGroupId === group.id && !isCreating;
                  return (
                    <button
                      key={group.id}
                      onClick={() => handleSelectExisting(group)}
                      title={full ? `Full (${maxPerGroup}/${maxPerGroup}) — open to remove or replace an account` : undefined}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                        selected
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-100 hover:border-emerald-200 hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: group.color || "#10b981" }}
                      >
                        <Folder className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="font-semibold text-slate-800 text-sm block truncate">
                          {group.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${full ? "bg-red-500" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(100, (count / maxPerGroup) * 100)}%` }}
                            />
                          </div>
                          <span className={`text-[11px] ${full ? "text-red-600 font-semibold" : "text-slate-400"}`}>
                            {count}/{maxPerGroup}{full ? " – Full" : ""}
                          </span>
                        </div>
                      </div>
                      {selected && (
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Info when a full group is selected */}
              {selectedIsFull && !isCreating && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    <strong>{selectedGroup.name}</strong> is full ({maxPerGroup}/{maxPerGroup}). You can open it,
                    but to add a new account you must first remove an existing one from this group.
                  </p>
                </div>
              )}

              <button
                onClick={() => { setIsCreating(true); setSelectedGroupId(null); setError(""); }}
                disabled={userLimitReached}
                title={userLimitReached ? `Account limit reached (${maxAccounts}/${maxAccounts})` : undefined}
                className="mt-3 w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-sm text-slate-500 hover:text-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Create new group instead
              </button>
            </div>
          )}

          {/* Create new group form */}
          {isCreating && (
            <div className={`${groups.length > 0 ? "border-t border-slate-100 pt-5" : ""}`}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {groups.length === 0 ? "Create Your First Group" : "New Group"}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Group Name
                  </label>
                  <input
                    autoFocus
                    type="text"
                    placeholder='e.g. "Sales Team", "Marketing", "Personal"'
                    value={newGroupName}
                    onChange={(e) => { setNewGroupName(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateAndProceed()}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Each group can hold up to {maxPerGroup} mail accounts.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Group Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GROUP_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewGroupColor(color)}
                        className={`w-7 h-7 rounded-full transition-all ${
                          newGroupColor === color
                            ? "ring-2 ring-offset-2 ring-slate-400 scale-110"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-600 font-medium">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={continueDisabled}
            onClick={isCreating ? handleCreateAndProceed : handleSelectAndProceed}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-lg shadow-emerald-500/30 disabled:opacity-50"
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}