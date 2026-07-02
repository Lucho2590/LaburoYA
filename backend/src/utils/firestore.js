// Helpers para leer muchos documentos por id en pocos round-trips, evitando
// patrones N+1 (un getDoc por item). db.getAll(...refs) trae todos los docs
// pedidos en una sola llamada.

// Devuelve un array de DocumentSnapshots para los ids dados (vacío si no hay ids).
async function getAllByIds(db, collection, ids) {
  if (!ids || ids.length === 0) return [];
  const refs = ids.map((id) => db.collection(collection).doc(id));
  return db.getAll(...refs);
}

// Igual que getAllByIds pero devuelve un Map id -> data() solo con los que existen.
async function getDocMapByIds(db, collection, ids) {
  const map = new Map();
  const snaps = await getAllByIds(db, collection, ids);
  snaps.forEach((doc) => {
    if (doc.exists) map.set(doc.id, doc.data());
  });
  return map;
}

module.exports = { getAllByIds, getDocMapByIds };
