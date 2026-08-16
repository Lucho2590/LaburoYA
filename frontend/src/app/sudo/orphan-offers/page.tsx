import { redirect } from 'next/navigation';

// La pantalla se unificó en /sudo/limpieza. Se mantiene la ruta para no romper
// links ni marcadores existentes.
export default function OrphanOffersRedirect() {
  redirect('/sudo/limpieza?tab=ofertas');
}
