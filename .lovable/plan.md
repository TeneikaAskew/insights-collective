

## Plan: Wire Up User Delete and Role Update (Using Existing Edge Function)

### What's already done
- The `admin-users` edge function already supports `deleteUser` and `updateUserRole` actions
- The `update_user_roles` RPC already exists and works
- The UI has stub buttons that show toasts but don't call anything

### What needs to happen

**1. Wire up bulk delete in `AdminUsers.tsx`**
- Replace the stub `handleBulkDelete` with a confirmation dialog
- On confirm, call the existing `admin-users` edge function with `action: 'deleteUser'` for each selected user
- Refresh the user list after completion

**2. Wire up bulk role update in `AdminUsers.tsx`**
- Replace the stub `handleBulkRoleUpdate` with a role picker dialog
- On confirm, call `updateUserRole` from `useAdminUsers` hook for each selected user

**3. Add `deleteUsers` method to `useAdminUsers.ts`**
- Add a function that invokes the existing `admin-users` edge function with `action: 'deleteUser'`
- Handle errors and refresh the list

**4. Fix role data source in `useAdminUsers.ts`**
- Change `fetchUsers` to read roles from the `user_roles` table (via `get_user_roles` RPC or a join) instead of the legacy `profiles.roles` column
- This ensures role updates are immediately reflected in the UI

### Files to modify
| File | Change |
|------|--------|
| `src/hooks/useAdminUsers.ts` | Add `deleteUsers`, fix role fetching |
| `src/pages/AdminUsers.tsx` | Replace stub handlers with real logic + confirmation dialogs |

### No new edge function needed
The existing `admin-users` edge function handles deletion via `supabase.auth.admin.deleteUser()` with the service role key. We just need to call it from the frontend.

