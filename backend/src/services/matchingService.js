const { getDb } = require('../config/firebase');

class MatchingService {
  // Find matches when a worker creates/updates their profile
  async findMatchesForWorker(workerId, workerData) {
    const db = getDb();
    const matches = [];

    // Find active job offers that match worker's rubro and puesto
    const jobOffersSnapshot = await db.collection('jobOffers')
      .where('rubro', '==', workerData.rubro)
      .where('puesto', '==', workerData.puesto)
      .where('active', '==', true)
      .get();

    for (const jobDoc of jobOffersSnapshot.docs) {
      const jobOffer = jobDoc.data();

      // Check if match already exists
      const existingMatch = await db.collection('matches')
        .where('workerId', '==', workerId)
        .where('offerId', '==', jobDoc.id)
        .get();

      if (existingMatch.empty) {
        // Create new match
        const matchRef = await db.collection('matches').add({
          workerId,
          employerId: jobOffer.employerId,
          offerId: jobDoc.id,
          rubro: workerData.rubro,
          puesto: workerData.puesto,
          status: 'pending', // pending, accepted, rejected
          createdAt: new Date()
        });

        matches.push({
          id: matchRef.id,
          offerId: jobDoc.id,
          employerId: jobOffer.employerId
        });
      }
    }

    return matches;
  }

  // Find matches when an employer creates a job offer
  async findMatchesForJobOffer(offerId, jobOfferData) {
    const db = getDb();
    const matches = [];

    // Find active workers that match the job's rubro and puesto
    const workersSnapshot = await db.collection('workers')
      .where('rubro', '==', jobOfferData.rubro)
      .where('puesto', '==', jobOfferData.puesto)
      .where('active', '==', true)
      .get();

    for (const workerDoc of workersSnapshot.docs) {
      // Check if match already exists
      const existingMatch = await db.collection('matches')
        .where('workerId', '==', workerDoc.id)
        .where('offerId', '==', offerId)
        .get();

      if (existingMatch.empty) {
        // Create new match
        const matchRef = await db.collection('matches').add({
          workerId: workerDoc.id,
          employerId: jobOfferData.employerId,
          offerId,
          rubro: jobOfferData.rubro,
          puesto: jobOfferData.puesto,
          status: 'pending',
          createdAt: new Date()
        });

        matches.push({
          id: matchRef.id,
          workerId: workerDoc.id
        });
      }
    }

    return matches;
  }

  // Get all matches for a user (worker or employer)
  async getMatchesForUser(uid, role) {
    const db = getDb();
    let matchesSnapshot;

    if (role === 'worker') {
      matchesSnapshot = await db.collection('matches')
        .where('workerId', '==', uid)
        .orderBy('createdAt', 'desc')
        .get();
    } else {
      matchesSnapshot = await db.collection('matches')
        .where('employerId', '==', uid)
        .orderBy('createdAt', 'desc')
        .get();
    }

    const matches = [];
    for (const doc of matchesSnapshot.docs) {
      const matchData = doc.data();

      // Enrich with related data
      let enrichedMatch = {
        id: doc.id,
        ...matchData,
        createdAt: matchData.createdAt?.toDate?.() || matchData.createdAt
      };

      // Get related worker or employer info
      if (role === 'worker') {
        const employerDoc = await db.collection('employers').doc(matchData.employerId).get();
        if (employerDoc.exists) {
          enrichedMatch.employer = employerDoc.data();
        }
        const jobDoc = await db.collection('jobOffers').doc(matchData.offerId).get();
        if (jobDoc.exists) {
          enrichedMatch.jobOffer = jobDoc.data();
        }
      } else {
        const workerDoc = await db.collection('workers').doc(matchData.workerId).get();
        if (workerDoc.exists) {
          enrichedMatch.worker = workerDoc.data();
        }
      }

      matches.push(enrichedMatch);
    }

    return matches;
  }

  // Update match status
  async updateMatchStatus(matchId, uid, status) {
    const db = getDb();
    const matchRef = db.collection('matches').doc(matchId);
    const matchDoc = await matchRef.get();

    if (!matchDoc.exists) {
      throw new Error('Match not found');
    }

    const matchData = matchDoc.data();

    // Verify ownership
    if (matchData.workerId !== uid && matchData.employerId !== uid) {
      throw new Error('Unauthorized');
    }

    await matchRef.update({
      status,
      updatedAt: new Date()
    });

    return { id: matchId, status };
  }
}

module.exports = new MatchingService();
