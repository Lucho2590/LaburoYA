import { redirect } from 'next/navigation';

// La pantalla se unificó en /sudo/limpieza. Se mantiene la ruta para no romper
// links ni marcadores existentes.
export default function OrphansRedirect() {
  redirect('/sudo/limpieza?tab=perfiles');
}
