// Acceso de administración (superuser).
// IMPORTANTE: único punto del backend que decide QUIÉN puede ser admin.
// Un superuser necesita las dos cosas: `users/{uid}.role === 'superuser'` Y un
// email en ADMIN_EMAILS. Los superusers que no estén en la lista quedan dados
// de baja (su doc no se toca): para reactivar a alguien, sumar su email acá.
const ADMIN_EMAILS = ['luciano@laburoya.com'];

function isAllowedAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
}

// Compat: antes era "cualquier @laburoya.com". Ahora sólo la allowlist.
// Se usa para autoaprovisionar el doc superuser en /auth/me.
function isSuperuserEmail(email) {
  return isAllowedAdminEmail(email);
}

// True si el doc es superuser pero su email no está habilitado como admin.
function isDisabledSuperuser(userData, email) {
  return !!userData && userData.role === 'superuser' && !isAllowedAdminEmail(email);
}

module.exports = { ADMIN_EMAILS, isAllowedAdminEmail, isSuperuserEmail, isDisabledSuperuser };
