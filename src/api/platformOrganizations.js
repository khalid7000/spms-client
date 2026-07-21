import platformApi from './platformAxios'

const unwrap = (r) => r.data.data

export const getDashboard = () =>
  platformApi.get('/api/platform/dashboard').then(unwrap)

export const checkSlugAvailable = (slug) =>
  platformApi.get('/api/platform/organizations/slug-check', { params: { slug } }).then(unwrap)

// payload: FormData with name, slug, address, description, isDefault, adminEmail,
// adminPassword, and an optional logo file -- matches PlatformOrganizationController's
// multipart/form-data endpoint.
export const createOrganization = (formData) =>
  platformApi.post('/api/platform/organizations', formData).then(unwrap)

export const getOrgUsers = (orgId) =>
  platformApi.get(`/api/platform/organizations/${orgId}/users`).then(unwrap)

// Renaming a slug only changes the org's login URL/routing key -- its underlying schema
// is untouched, and already-logged-in sessions (JWTs carry the schema, not the slug) keep
// working. See OrganizationProvisioningService.renameSlug's javadoc for why the two are
// deliberately decoupled.
export const renameOrgSlug = (orgId, slug) =>
  platformApi.patch(`/api/platform/organizations/${orgId}/slug`, { slug }).then(unwrap)

// Returns { newPassword } -- shown once, never stored/logged.
export const resetOrgUserPassword = (orgId, userId) =>
  platformApi.post(`/api/platform/organizations/${orgId}/users/${userId}/reset-password`).then(unwrap)
