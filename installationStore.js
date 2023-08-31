const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL, { family: 6 });
redis.on('connect', function () {
  console.info('Redis connected');
});

const installationStore = {
  storeInstallation: async (installation) => {
    const installationString = JSON.stringify(installation);
    // Bolt will pass your handler an installation object
    // Change the lines below so they save to your database
    if (
      installation.isEnterpriseInstall &&
      installation.enterprise !== undefined
    ) {
      // handle storing org-wide app installation
      return redis.set(installation.enterprise.id, installationString);
    }
    if (installation.team !== undefined) {
      // single team app installation
      return redis.set(installation.team.id, installationString);
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
      const res = await redis.get(installQuery.enterpriseId);
      return JSON.parse(res);
    }
    if (installQuery.teamId !== undefined) {
      // single team app installation lookup
      const res = await redis.get(installQuery.teamId);
      return JSON.parse(res);
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
      return redis.del(installQuery.enterpriseId);
    }
    if (installQuery.teamId !== undefined) {
      // single team app installation deletion
      return redis.del(installQuery.teamId);
    }
    throw new Error('Failed to delete installation');
  },
};

module.exports = installationStore;
