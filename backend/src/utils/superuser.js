// Detección de cuentas superuser por dominio de email.
// IMPORTANTE: este es el ÚNICO punto del backend acoplado al dominio @laburoya.com.
// Para migrar a detección por `role === 'superuser'` (superusers que no sean @laburoya.com),
// basta con setear el doc users/{uid} con role 'superuser'; el resto del código ya es role-based.
function isSuperuserEmail(email) {
  return !!email && email.endsWith('@laburoya.com');
}

module.exports = { isSuperuserEmail };
