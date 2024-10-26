import * as fs from "fs";
import * as path from "path";
import { type CustomRoute } from "@slack/bolt";

const indexHTML = fs.readFileSync(
  path.resolve(__dirname, "../../public/index.html")
);

const customRoutes: CustomRoute[] = [
  {
    path: "/",
    method: ["GET"],
    handler: (req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(indexHTML);
    },
  },
];

export default customRoutes;
