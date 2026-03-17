const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

/**
 * Envía email de invitación a un nuevo usuario
 */
async function sendInvitationEmail({ to, firstName, resetLink }) {
  const { data, error } = await resend.emails.send({
    from: `LaburoYA <${FROM_EMAIL}>`,
    to,
    subject: '¡Te invitamos a LaburoYA!',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="margin: 0; font-size: 32px; font-weight: bold; background: linear-gradient(to right, #E10600, #FF6A00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                  LaburoYA
                </h1>
              </div>

              <!-- Saludo -->
              <h2 style="color: #1a1a1a; font-size: 24px; margin: 0 0 16px 0;">
                ¡Hola${firstName ? ` ${firstName}` : ''}!
              </h2>

              <!-- Mensaje -->
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Te creamos una cuenta en <strong>LaburoYA</strong>. Para empezar, necesitás establecer tu contraseña.
              </p>

              <!-- Botón -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}"
                   style="display: inline-block; background: linear-gradient(to right, #E10600, #FF6A00);
                          color: white; padding: 16px 48px; border-radius: 12px;
                          text-decoration: none; font-weight: 600; font-size: 16px;">
                  Activar mi cuenta
                </a>
              </div>

              <!-- Instrucciones -->
              <p style="color: #4a4a4a; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
                Una vez que establezcas tu contraseña, vas a poder:
              </p>
              <ul style="color: #4a4a4a; font-size: 14px; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
                <li>Completar tu perfil</li>
                <li>Conectar con empleadores o trabajadores</li>
                <li>Acceder a todas las funcionalidades de la plataforma</li>
              </ul>

              <!-- Link alternativo -->
              <p style="color: #888; font-size: 12px; line-height: 1.6; margin: 24px 0 0 0; padding-top: 24px; border-top: 1px solid #eee;">
                Si el botón no funciona, copiá y pegá este link en tu navegador:<br>
                <a href="${resetLink}" style="color: #E10600; word-break: break-all;">${resetLink}</a>
              </p>

            </div>

            <!-- Footer -->
            <p style="text-align: center; color: #888; font-size: 12px; margin-top: 24px;">
              Si no esperabas este email, podés ignorarlo.<br>
              © ${new Date().getFullYear()} LaburoYA
            </p>
          </div>
        </body>
      </html>
    `
  });

  if (error) {
    console.error('Error sending invitation email:', error);
    throw new Error(`Error enviando email: ${error.message}`);
  }

  return data;
}

/**
 * Envía email de reset de password (para usuarios existentes)
 */
async function sendPasswordResetEmail({ to, firstName, resetLink }) {
  const { data, error } = await resend.emails.send({
    from: `LaburoYA <${FROM_EMAIL}>`,
    to,
    subject: 'Restablecé tu contraseña - LaburoYA',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="margin: 0; font-size: 32px; font-weight: bold; background: linear-gradient(to right, #E10600, #FF6A00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                  LaburoYA
                </h1>
              </div>

              <!-- Saludo -->
              <h2 style="color: #1a1a1a; font-size: 24px; margin: 0 0 16px 0;">
                ¿Olvidaste tu contraseña?
              </h2>

              <!-- Mensaje -->
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                ${firstName ? `Hola ${firstName}, n` : 'N'}o te preocupes, hacé click en el botón para crear una nueva contraseña.
              </p>

              <!-- Botón -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}"
                   style="display: inline-block; background: linear-gradient(to right, #E10600, #FF6A00);
                          color: white; padding: 16px 48px; border-radius: 12px;
                          text-decoration: none; font-weight: 600; font-size: 16px;">
                  Restablecer contraseña
                </a>
              </div>

              <!-- Link alternativo -->
              <p style="color: #888; font-size: 12px; line-height: 1.6; margin: 24px 0 0 0; padding-top: 24px; border-top: 1px solid #eee;">
                Si el botón no funciona, copiá y pegá este link en tu navegador:<br>
                <a href="${resetLink}" style="color: #E10600; word-break: break-all;">${resetLink}</a>
              </p>

              <p style="color: #888; font-size: 12px; margin-top: 16px;">
                Este link expira en 1 hora.
              </p>

            </div>

            <!-- Footer -->
            <p style="text-align: center; color: #888; font-size: 12px; margin-top: 24px;">
              Si no solicitaste este email, podés ignorarlo. Tu contraseña no cambiará.<br>
              © ${new Date().getFullYear()} LaburoYA
            </p>
          </div>
        </body>
      </html>
    `
  });

  if (error) {
    console.error('Error sending password reset email:', error);
    throw new Error(`Error enviando email: ${error.message}`);
  }

  return data;
}

module.exports = {
  sendInvitationEmail,
  sendPasswordResetEmail
};
