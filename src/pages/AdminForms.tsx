import { Navigate } from 'react-router-dom';

// Legacy forms page — redirects to the unified form management interface.
const AdminForms = () => <Navigate to="/admin/unified-form-management" replace />;

export default AdminForms;
