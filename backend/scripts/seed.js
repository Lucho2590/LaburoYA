/**
 * Script de seeding para crear usuarios de prueba
 *
 * Uso: node scripts/seed.js
 *
 * Crea:
 * - 10 Workers con diferentes perfiles (rubros, puestos, zonas, skills)
 * - 5 Employers con ofertas de trabajo variadas
 *
 * Password para todos: 123456
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Inicializar Firebase Admin
let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey
  })
});

const db = admin.firestore();
const auth = admin.auth();

// ============================================
// RUBROS (Categorías de trabajo dinámicas)
// ============================================

const RUBROS = [
  { nombre: 'Gastronomía', icono: '🍳', orden: 0 },
  { nombre: 'Comercio', icono: '🏪', orden: 1 },
  { nombre: 'Construcción', icono: '🏗️', orden: 2 },
  { nombre: 'Limpieza', icono: '🧹', orden: 3 },
  { nombre: 'Transporte', icono: '🚗', orden: 4 },
  { nombre: 'Administración', icono: '💼', orden: 5 },
];

// ============================================
// DATOS DE PRUEBA
// ============================================

const WORKERS = [
  {
    email: 'worker1@test.com',
    firstName: 'Juan',
    lastName: 'Pérez',
    rubro: 'gastronomia',
    puesto: 'Cocinero',
    zona: 'Centro',
    description: 'Cocinero con 5 años de experiencia en restaurantes de Mar del Plata',
    experience: 'Trabajé en La Perla Restaurant, Manolo y El Club de la Milanesa',
    skills: ['Cocina internacional', 'Parrilla', 'Trabajo en equipo', 'Puntualidad']
  },
  {
    email: 'worker2@test.com',
    firstName: 'María',
    lastName: 'González',
    rubro: 'gastronomia',
    puesto: 'Mozo',
    zona: 'Centro',
    description: 'Moza con experiencia en atención al cliente de alta calidad',
    experience: '3 años en restaurantes céntricos',
    skills: ['Atención al cliente', 'Manejo de bandeja', 'Inglés básico', 'Trabajo bajo presión']
  },
  {
    email: 'worker3@test.com',
    firstName: 'Carlos',
    lastName: 'Rodríguez',
    rubro: 'gastronomia',
    puesto: 'Cocinero',
    zona: 'Puerto',
    description: 'Especialista en cocina de mar y parrilla',
    experience: 'Chef en restaurantes del puerto por 7 años',
    skills: ['Cocina internacional', 'Parrilla', 'Pastelería', 'Manejo de stock']
  },
  {
    email: 'worker4@test.com',
    firstName: 'Ana',
    lastName: 'Martínez',
    rubro: 'comercio',
    puesto: 'Vendedor',
    zona: 'Centro',
    description: 'Vendedora con excelente trato al público',
    experience: 'Vendedora en tiendas de ropa por 4 años',
    skills: ['Técnicas de venta', 'Atención al cliente', 'Comunicación', 'Fidelización de clientes']
  },
  {
    email: 'worker5@test.com',
    firstName: 'Pedro',
    lastName: 'López',
    rubro: 'comercio',
    puesto: 'Cajero',
    zona: 'Güemes',
    description: 'Cajero responsable y puntual',
    experience: 'Supermercados y comercios varios',
    skills: ['Manejo de caja', 'Cobro con tarjetas', 'Arqueo de caja', 'Matemáticas básicas']
  },
  {
    email: 'worker6@test.com',
    firstName: 'Laura',
    lastName: 'Fernández',
    rubro: 'limpieza',
    puesto: 'Empleada doméstica',
    zona: 'Los Troncos',
    description: 'Empleada doméstica con referencias comprobables',
    experience: 'Más de 10 años de experiencia en casas particulares',
    skills: ['Limpieza profunda', 'Planchado', 'Cocina básica', 'Organización del hogar']
  },
  {
    email: 'worker7@test.com',
    firstName: 'Roberto',
    lastName: 'Sánchez',
    rubro: 'construccion',
    puesto: 'Electricista',
    zona: 'Constitución',
    description: 'Electricista matriculado con amplia experiencia',
    experience: 'Instalaciones residenciales y comerciales',
    skills: ['Instalaciones domiciliarias', 'Tableros eléctricos', 'Normas de seguridad', 'Lectura de planos eléctricos']
  },
  {
    email: 'worker8@test.com',
    firstName: 'Lucía',
    lastName: 'Díaz',
    rubro: 'administracion',
    puesto: 'Recepcionista',
    zona: 'Centro',
    description: 'Recepcionista bilingüe con excelente presencia',
    experience: 'Hoteles y consultorios médicos',
    skills: ['Atención al público', 'Agenda de turnos', 'Inglés básico', 'Manejo de PC']
  },
  {
    email: 'worker9@test.com',
    firstName: 'Diego',
    lastName: 'Torres',
    rubro: 'transporte',
    puesto: 'Repartidor',
    zona: 'Centro',
    description: 'Repartidor con moto propia y conocimiento de la ciudad',
    experience: 'Delivery en apps y comercios locales',
    skills: ['Moto propia', 'Conocimiento de zonas', 'Rapidez', 'Manejo de efectivo']
  },
  {
    email: 'worker10@test.com',
    firstName: 'Sofía',
    lastName: 'Ruiz',
    rubro: 'gastronomia',
    puesto: 'Barman',
    zona: 'La Perla',
    description: 'Barwoman con especialización en coctelería',
    experience: 'Bares y pubs de la costa',
    skills: ['Coctelería clásica', 'Coctelería de autor', 'Atención al cliente', 'Manejo de caja']
  }
];

const EMPLOYERS = [
  {
    email: 'employer1@test.com',
    firstName: 'Ricardo',
    lastName: 'Gómez',
    businessName: 'Restaurante La Costa',
    rubro: 'gastronomia',
    description: 'Restaurante familiar con 20 años de trayectoria',
    address: 'Av. Colón 1234, Centro',
    phone: '223-4567890',
    jobOffers: [
      {
        rubro: 'gastronomia',
        puesto: 'Cocinero',
        zona: 'Centro',
        description: 'Buscamos cocinero para turno noche',
        requirements: 'Experiencia mínima 2 años',
        salary: '$350.000 - $400.000',
        schedule: 'Lunes a Sábado 18:00 a 02:00',
        requiredSkills: ['Cocina internacional', 'Parrilla', 'Trabajo en equipo']
      },
      {
        rubro: 'gastronomia',
        puesto: 'Mozo',
        zona: 'Centro',
        description: 'Mozo/a para temporada de verano',
        requirements: 'Buena presencia, experiencia en atención al público',
        salary: '$280.000 + propinas',
        schedule: 'Viernes a Domingo 12:00 a 00:00',
        requiredSkills: ['Atención al cliente', 'Manejo de bandeja', 'Inglés básico']
      }
    ]
  },
  {
    email: 'employer2@test.com',
    firstName: 'Marta',
    lastName: 'Vázquez',
    businessName: 'Tienda Moda Sur',
    rubro: 'comercio',
    description: 'Tienda de ropa y accesorios en el centro',
    address: 'Peatonal San Martín 567',
    phone: '223-5551234',
    jobOffers: [
      {
        rubro: 'comercio',
        puesto: 'Vendedor',
        zona: 'Centro',
        description: 'Vendedor/a full time para temporada',
        requirements: 'Experiencia en ventas, buena presencia',
        salary: '$300.000 + comisiones',
        schedule: 'Lunes a Sábado 10:00 a 20:00 (rotativo)',
        requiredSkills: ['Técnicas de venta', 'Atención al cliente', 'Comunicación']
      },
      {
        rubro: 'comercio',
        puesto: 'Cajero',
        zona: 'Centro',
        description: 'Cajero/a para fines de semana',
        requirements: 'Manejo de efectivo y tarjetas',
        salary: '$250.000',
        schedule: 'Viernes a Domingo',
        requiredSkills: ['Manejo de caja', 'Cobro con tarjetas', 'Atención rápida']
      }
    ]
  },
  {
    email: 'employer3@test.com',
    firstName: 'Fernando',
    lastName: 'Álvarez',
    businessName: 'Constructora MDP',
    rubro: 'construccion',
    description: 'Empresa constructora de obras civiles',
    address: 'Av. Independencia 2345',
    phone: '223-4443322',
    jobOffers: [
      {
        rubro: 'construccion',
        puesto: 'Electricista',
        zona: 'Constitución',
        description: 'Electricista para obra en Constitución',
        requirements: 'Matrícula habilitante, experiencia en obra',
        salary: '$450.000',
        schedule: 'Lunes a Viernes 8:00 a 17:00',
        requiredSkills: ['Instalaciones domiciliarias', 'Tableros eléctricos', 'Normas de seguridad']
      }
    ]
  },
  {
    email: 'employer4@test.com',
    firstName: 'Cecilia',
    lastName: 'Moreno',
    businessName: 'Hotel Playa Grande',
    rubro: 'limpieza',
    description: 'Hotel 4 estrellas frente al mar',
    address: 'Bv. Marítimo 4500',
    phone: '223-6667788',
    jobOffers: [
      {
        rubro: 'limpieza',
        puesto: 'Mucama',
        zona: 'La Perla',
        description: 'Mucama para temporada alta',
        requirements: 'Experiencia en hotelería',
        salary: '$280.000',
        schedule: 'Turno mañana o tarde, rotativo',
        requiredSkills: ['Tendido de camas', 'Limpieza de habitaciones', 'Atención a huéspedes']
      },
      {
        rubro: 'gastronomia',
        puesto: 'Barman',
        zona: 'La Perla',
        description: 'Barman para bar del hotel',
        requirements: 'Experiencia en coctelería',
        salary: '$320.000 + propinas',
        schedule: 'Miércoles a Domingo 20:00 a 04:00',
        requiredSkills: ['Coctelería clásica', 'Coctelería de autor', 'Atención al cliente']
      }
    ]
  },
  {
    email: 'employer5@test.com',
    firstName: 'Gustavo',
    lastName: 'Herrera',
    businessName: 'Consultorio Médico Salud+',
    rubro: 'administracion',
    description: 'Centro médico con múltiples especialidades',
    address: 'Av. Luro 3456',
    phone: '223-7778899',
    jobOffers: [
      {
        rubro: 'administracion',
        puesto: 'Recepcionista',
        zona: 'Centro',
        description: 'Recepcionista para consultorio médico',
        requirements: 'Experiencia en atención al público, manejo de agenda',
        salary: '$320.000',
        schedule: 'Lunes a Viernes 8:00 a 16:00',
        requiredSkills: ['Atención al público', 'Agenda de turnos', 'Manejo de PC']
      }
    ]
  }
];

// ============================================
// FUNCIONES DE SEEDING
// ============================================

async function createUser(email, password, displayName) {
  try {
    // Verificar si el usuario ya existe
    try {
      const existingUser = await auth.getUserByEmail(email);
      console.log(`  ⚠️  Usuario ${email} ya existe (uid: ${existingUser.uid})`);
      return existingUser;
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Crear usuario nuevo
    const user = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true
    });
    console.log(`  ✓ Usuario creado: ${email} (uid: ${user.uid})`);
    return user;
  } catch (error) {
    console.error(`  ✗ Error creando usuario ${email}:`, error.message);
    throw error;
  }
}

async function createWorker(workerData) {
  console.log(`\nCreando worker: ${workerData.firstName} ${workerData.lastName}`);

  // 1. Crear usuario en Auth
  const user = await createUser(
    workerData.email,
    '123456',
    `${workerData.firstName} ${workerData.lastName}`
  );

  // 2. Crear documento en users
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    role: 'worker',
    firstName: workerData.firstName,
    lastName: workerData.lastName,
    onboardingCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }, { merge: true });
  console.log(`  ✓ Documento user creado`);

  // 3. Crear perfil de worker
  await db.collection('workers').doc(user.uid).set({
    uid: user.uid,
    rubro: workerData.rubro,
    puesto: workerData.puesto,
    zona: workerData.zona,
    description: workerData.description,
    experience: workerData.experience,
    skills: workerData.skills,
    videoUrl: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }, { merge: true });
  console.log(`  ✓ Perfil worker creado: ${workerData.rubro} - ${workerData.puesto} (${workerData.zona})`);

  return user.uid;
}

async function createEmployer(employerData) {
  console.log(`\nCreando employer: ${employerData.businessName}`);

  // 1. Crear usuario en Auth
  const user = await createUser(
    employerData.email,
    '123456',
    `${employerData.firstName} ${employerData.lastName}`
  );

  // 2. Crear documento en users
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    role: 'employer',
    firstName: employerData.firstName,
    lastName: employerData.lastName,
    onboardingCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }, { merge: true });
  console.log(`  ✓ Documento user creado`);

  // 3. Crear perfil de employer
  await db.collection('employers').doc(user.uid).set({
    uid: user.uid,
    businessName: employerData.businessName,
    rubro: employerData.rubro,
    description: employerData.description,
    address: employerData.address,
    phone: employerData.phone,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }, { merge: true });
  console.log(`  ✓ Perfil employer creado`);

  // 4. Crear ofertas de trabajo
  for (const offer of employerData.jobOffers) {
    const jobRef = await db.collection('jobOffers').add({
      employerId: user.uid,
      rubro: offer.rubro,
      puesto: offer.puesto,
      zona: offer.zona,
      description: offer.description,
      requirements: offer.requirements,
      salary: offer.salary,
      schedule: offer.schedule,
      requiredSkills: offer.requiredSkills,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`  ✓ Oferta creada: ${offer.puesto} (${offer.zona}) - ID: ${jobRef.id}`);
  }

  return user.uid;
}

async function seedRubros() {
  console.log('\n📂 CREANDO RUBROS');
  console.log('-----------------------------------------');

  for (const rubro of RUBROS) {
    // Check if rubro already exists by name
    const existing = await db.collection('rubros')
      .where('nombre', '==', rubro.nombre)
      .limit(1)
      .get();

    if (!existing.empty) {
      console.log(`  ⚠️  Rubro "${rubro.nombre}" ya existe`);
      continue;
    }

    await db.collection('rubros').add({
      ...rubro,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`  ✓ Rubro creado: ${rubro.icono} ${rubro.nombre}`);
  }
}

async function seed() {
  console.log('=========================================');
  console.log('🌱 SEEDING LABURO-YA');
  console.log('=========================================');
  console.log('Password para todos los usuarios: 123456\n');

  try {
    // Crear rubros primero
    await seedRubros();

    // Crear workers
    console.log('\n📋 CREANDO WORKERS');
    console.log('-----------------------------------------');
    for (const worker of WORKERS) {
      await createWorker(worker);
    }

    // Crear employers
    console.log('\n\n🏢 CREANDO EMPLOYERS');
    console.log('-----------------------------------------');
    for (const employer of EMPLOYERS) {
      await createEmployer(employer);
    }

    console.log('\n\n=========================================');
    console.log('✅ SEEDING COMPLETADO');
    console.log('=========================================');

    console.log('\n📊 RESUMEN:');
    console.log(`   Rubros creados: ${RUBROS.length}`);
    console.log(`   Workers creados: ${WORKERS.length}`);
    console.log(`   Employers creados: ${EMPLOYERS.length}`);
    console.log(`   Ofertas de trabajo: ${EMPLOYERS.reduce((acc, e) => acc + e.jobOffers.length, 0)}`);

    console.log('\n📧 EMAILS DE PRUEBA:');
    console.log('\n   WORKERS:');
    WORKERS.forEach(w => {
      console.log(`   - ${w.email} (${w.rubro}/${w.puesto} - ${w.zona})`);
    });
    console.log('\n   EMPLOYERS:');
    EMPLOYERS.forEach(e => {
      console.log(`   - ${e.email} (${e.businessName})`);
    });

    console.log('\n🔑 Password: 123456 (para todos)');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error durante el seeding:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar
seed();
