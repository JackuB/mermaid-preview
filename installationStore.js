const { createClient } = require('redis');
const redis = createClient({
  url: process.env.REDIS_URL,
});

const database = {
  async get(key) {
    return redis.get(key);
  },
  async delete(key) {
    return redis.del(key);
  },
  async set(key, value) {
    return redis.set(key, value);
  },
};

const installationStore = {
  storeInstallation: async (installation) => {
    // Bolt will pass your handler an installation object
    // Change the lines below so they save to your database
    if (
      installation.isEnterpriseInstall &&
      installation.enterprise !== undefined
    ) {
      // handle storing org-wide app installation
      return await database.set(installation.enterprise.id, installation);
    }
    if (installation.team !== undefined) {
      // single team app installation
      return await database.set(installation.team.id, installation);
    }
    throw new Error('Failed saving installation data to installationStore');
  },
  fetchInstallation: async (installQuery) => {
    // Bolt will pass your handler an installQuery object
    // Change the lines below so they fetch from your database
    if (
      installQuery.isEnterpriseInstall &&
      installQuery.enterpriseId !== undefined
    ) {
      // handle org wide app installation lookup
      return await database.get(installQuery.enterpriseId);
    }
    if (installQuery.teamId !== undefined) {
      // single team app installation lookup
      return await database.get(installQuery.teamId);
    }
    throw new Error('Failed fetching installation');
  },
  deleteInstallation: async (installQuery) => {
    // Bolt will pass your handler  an installQuery object
    // Change the lines below so they delete from your database
    if (
      installQuery.isEnterpriseInstall &&
      installQuery.enterpriseId !== undefined
    ) {
      // org wide app installation deletion
      return await database.delete(installQuery.enterpriseId);
    }
    if (installQuery.teamId !== undefined) {
      // single team app installation deletion
      return await database.delete(installQuery.teamId);
    }
    throw new Error('Failed to delete installation');
  },
};

module.exports = installationStore;
