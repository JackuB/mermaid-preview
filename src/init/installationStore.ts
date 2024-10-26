import { type InstallationStore } from "@slack/bolt";
import { getRedisClient } from "../redis";

export default async function () {
  const redis = await getRedisClient(0);
  const installationStore: InstallationStore = {
    storeInstallation: async (installation) => {
      const installationString = JSON.stringify(installation);
      // Bolt will pass your handler an installation object
      // Change the lines below so they save to your database
      if (
        installation.isEnterpriseInstall &&
        installation.enterprise !== undefined
      ) {
        // handle storing org-wide app installation
        await redis.set(installation.enterprise.id, installationString);
        return;
      }
      if (installation.team !== undefined) {
        // single team app installation
        await redis.set(installation.team.id, installationString);
        return;
      }
      throw new Error("Failed saving installation data to installationStore");
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
        return res ? JSON.parse(res) : null;
      }
      if (installQuery.teamId !== undefined) {
        // single team app installation lookup
        const res = await redis.get(installQuery.teamId);
        return res ? JSON.parse(res) : null;
      }
      throw new Error("Failed fetching installation");
    },
    deleteInstallation: async (installQuery) => {
      // Bolt will pass your handler  an installQuery object
      // Change the lines below so they delete from your database
      if (
        installQuery.isEnterpriseInstall &&
        installQuery.enterpriseId !== undefined
      ) {
        // org wide app installation deletion
        await redis.del(installQuery.enterpriseId);
        return;
      }
      if (installQuery.teamId !== undefined) {
        // single team app installation deletion
        await redis.del(installQuery.teamId);
        return;
      }
      throw new Error("Failed to delete installation");
    },
  };
  return installationStore;
}
