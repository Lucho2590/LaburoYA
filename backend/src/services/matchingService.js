const { getDb } = require('../config/firebase');

// Match type constants
const MATCH_TYPES = {
  FULL_MATCH: 'full_match',      // rubro + puesto + zona
  PARTIAL_MATCH: 'partial_match', // rubro + puesto (different zona)
  SKILLS_MATCH: 'skills_match'    // only skills match
};

// Score weights
const SCORES = {
  FULL_MATCH: 100,
  PARTIAL_MATCH: 50,
  SKILL_MATCH: 6,        // per matching skill (max 5 skills = 30 pts)
  VIDEO_BONUS: 10,
  DESCRIPTION_BONUS: 5,
  EXPERIENCE_BONUS: 5
};

class MatchingService {
  /**
   * Calculate relevance score between a worker and a job offer
   * @param {Object} worker - Worker profile data
   * @param {Object} offer - Job offer data
   * @returns {Object} { score, matchType, details }
   */
  calculateRelevanceScore(worker, offer) {
    let score = 0;
    let matchType = null;
    const details = {
      rubroMatch: false,
      puestoMatch: false,
      zonaMatch: false,
      matchingSkills: [],
      bonuses: []
    };

    // Check rubro and puesto match
    if (worker.rubro === offer.rubro && worker.puesto === offer.puesto) {
      details.rubroMatch = true;
      details.puestoMatch = true;

      // Check zona match
      if (worker.zona && offer.zona && worker.zona === offer.zona) {
        score = SCORES.FULL_MATCH;
        matchType = MATCH_TYPES.FULL_MATCH;
        details.zonaMatch = true;
      } else {
        score = SCORES.PARTIAL_MATCH;
        matchType = MATCH_TYPES.PARTIAL_MATCH;
      }
    }

    // Calculate skills match
    const workerSkills = worker.skills || [];
    const requiredSkills = offer.requiredSkills || [];

    if (workerSkills.length > 0 && requiredSkills.length > 0) {
      const matchingSkills = workerSkills.filter(skill =>
        requiredSkills.includes(skill)
      );
      details.matchingSkills = matchingSkills;

      // Cap at 5 skills (30 pts max)
      const skillScore = Math.min(matchingSkills.length, 5) * SCORES.SKILL_MATCH;
      score += skillScore;

      // If no rubro/puesto match but has skill matches, it's a skills match
      if (!matchType && matchingSkills.length > 0) {
        matchType = MATCH_TYPES.SKILLS_MATCH;
      }
    }

    // Bonus for video
    if (worker.videoUrl) {
      score += SCORES.VIDEO_BONUS;
      details.bonuses.push('video');
    }

    // Bonus for description
    if (worker.description && worker.description.length >= 50) {
      score += SCORES.DESCRIPTION_BONUS;
      details.bonuses.push('description');
    }

    // Bonus for experience
    if (worker.experience && worker.experience.length >= 20) {
      score += SCORES.EXPERIENCE_BONUS;
      details.bonuses.push('experience');
    }

    return {
      score,
      matchType,
      details
    };
  }

  /**
   * Get relevant offers for a worker, sorted by relevance
   * @param {string} workerId - Worker UID
   * @returns {Array} Sorted array of offers with relevance info
   */
  async getRelevantOffersForWorker(workerId) {
    const db = getDb();

    // Get worker profile
    const workerDoc = await db.collection('workers').doc(workerId).get();
    if (!workerDoc.exists) {
      throw new Error('Worker not found');
    }
    const worker = workerDoc.data();

    // Get all active job offers
    const offersSnapshot = await db.collection('jobOffers')
      .where('active', '==', true)
      .get();

    const relevantOffers = [];

    for (const doc of offersSnapshot.docs) {
      const offer = { id: doc.id, ...doc.data() };
      const relevance = this.calculateRelevanceScore(worker, offer);

      // Only include offers with some relevance
      if (relevance.score > 0) {
        // Get employer info
        const employerDoc = await db.collection('employers').doc(offer.employerId).get();
        const employer = employerDoc.exists ? employerDoc.data() : null;

        relevantOffers.push({
          ...offer,
          employer,
          relevance,
          createdAt: offer.createdAt?.toDate?.() || offer.createdAt
        });
      }
    }

    // Sort by score descending, then by createdAt descending
    relevantOffers.sort((a, b) => {
      if (b.relevance.score !== a.relevance.score) {
        return b.relevance.score - a.relevance.score;
      }
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return relevantOffers;
  }

  /**
   * Get relevant workers for an employer's job offer, sorted by relevance
   * @param {string} offerId - Job offer ID
   * @param {string} employerId - Employer UID (for verification)
   * @returns {Array} Sorted array of workers with relevance info
   */
  async getRelevantWorkersForOffer(offerId, employerId) {
    const db = getDb();

    // Get job offer
    const offerDoc = await db.collection('jobOffers').doc(offerId).get();
    if (!offerDoc.exists) {
      throw new Error('Job offer not found');
    }
    const offer = offerDoc.data();

    if (employerId && offer.employerId !== employerId) {
      throw new Error('Unauthorized');
    }

    // Get all active workers
    const workersSnapshot = await db.collection('workers')
      .where('active', '==', true)
      .get();

    const relevantWorkers = [];

    for (const doc of workersSnapshot.docs) {
      const worker = { uid: doc.id, ...doc.data() };
      const relevance = this.calculateRelevanceScore(worker, offer);

      // Only include workers with some relevance
      if (relevance.score > 0) {
        relevantWorkers.push({
          ...worker,
          relevance,
          createdAt: worker.createdAt?.toDate?.() || worker.createdAt
        });
      }
    }

    // Sort by score descending
    relevantWorkers.sort((a, b) => {
      if (b.relevance.score !== a.relevance.score) {
        return b.relevance.score - a.relevance.score;
      }
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return relevantWorkers;
  }

  /**
   * Get all relevant workers for all employer's offers
   * @param {string} employerId - Employer UID
   * @returns {Object} Workers grouped by match type
   */
  async getAllRelevantWorkersForEmployer(employerId) {
    const db = getDb();

    // Get all employer's active offers
    const offersSnapshot = await db.collection('jobOffers')
      .where('employerId', '==', employerId)
      .where('active', '==', true)
      .get();

    if (offersSnapshot.empty) {
      return { fullMatch: [], partialMatch: [], skillsMatch: [] };
    }

    // Get all active workers
    const workersSnapshot = await db.collection('workers')
      .where('active', '==', true)
      .get();

    const workerScores = new Map(); // uid -> { worker, bestScore, bestMatchType, bestOffer }

    for (const offerDoc of offersSnapshot.docs) {
      const offer = { id: offerDoc.id, ...offerDoc.data() };

      for (const workerDoc of workersSnapshot.docs) {
        const worker = { uid: workerDoc.id, ...workerDoc.data() };
        const relevance = this.calculateRelevanceScore(worker, offer);

        if (relevance.score > 0) {
          const existing = workerScores.get(worker.uid);
          if (!existing || relevance.score > existing.bestScore) {
            workerScores.set(worker.uid, {
              ...worker,
              bestScore: relevance.score,
              bestMatchType: relevance.matchType,
              bestOffer: offer,
              relevance
            });
          }
        }
      }
    }

    // Fetch user info (name, email) for each worker
    const workerUids = Array.from(workerScores.keys());
    const userInfoMap = new Map();

    for (const uid of workerUids) {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        userInfoMap.set(uid, {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email
        });
      }
    }

    // Group by match type
    const result = {
      fullMatch: [],
      partialMatch: [],
      skillsMatch: []
    };

    for (const workerData of workerScores.values()) {
      const userInfo = userInfoMap.get(workerData.uid) || {};
      const entry = {
        ...workerData,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        email: userInfo.email,
        createdAt: workerData.createdAt?.toDate?.() || workerData.createdAt
      };

      switch (workerData.bestMatchType) {
        case MATCH_TYPES.FULL_MATCH:
          result.fullMatch.push(entry);
          break;
        case MATCH_TYPES.PARTIAL_MATCH:
          result.partialMatch.push(entry);
          break;
        case MATCH_TYPES.SKILLS_MATCH:
          result.skillsMatch.push(entry);
          break;
      }
    }

    // Sort each group by score
    Object.keys(result).forEach(key => {
      result[key].sort((a, b) => b.bestScore - a.bestScore);
    });

    return result;
  }
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

    console.log('[MatchingService] getMatchesForUser:', { uid, role });

    // Query without orderBy to avoid index requirement, then sort in memory
    if (role === 'worker') {
      matchesSnapshot = await db.collection('matches')
        .where('workerId', '==', uid)
        .get();
    } else {
      matchesSnapshot = await db.collection('matches')
        .where('employerId', '==', uid)
        .get();
    }

    console.log('[MatchingService] Found matches:', matchesSnapshot.size);

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

    // Sort by createdAt descending (newest first)
    matches.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

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

const matchingServiceInstance = new MatchingService();

module.exports = matchingServiceInstance;
module.exports.MATCH_TYPES = MATCH_TYPES;
module.exports.SCORES = SCORES;
